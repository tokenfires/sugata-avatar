"""Finite local measured-fit diagnostic. No image upload, asset writes or package installation."""
import json, time, math, pathlib, sys
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/evidence/ember-2026-10-31-measured-fit'
START=time.monotonic()
CENTER=np.array([0,1.47,.10]); FOCAL=512/math.tan(math.radians(14))
base=np.fromfile(OUT/'native-positions.f32',dtype='<f4').astype(float).reshape(-1,3)
vertex_map=np.fromfile(ROOT/'assets/identity/figure-vertex-map.bin',dtype='<u2')
lookup={int(v):i for i,v in reversed(list(enumerate(vertex_map)))}
data=json.loads((OUT/'observations-v001.json').read_text())

def points(positions,anchors):
 return np.array([sum(positions[lookup[v]]*w for v,w in zip(a['vertices'],a['weights'])) for a in anchors])

def rotate(p,c):
 yaw,pitch,roll=c[:3];cy,sy=np.cos(yaw),np.sin(yaw);cx,sx=np.cos(pitch),np.sin(pitch);cz,sz=np.cos(roll),np.sin(roll)
 rx=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]]);ry=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]);rz=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
 return (p-CENTER)@(rz@ry@rx).T

def project(p,c):
 q=rotate(p,c);q[:,:2]+=c[4:6];d=np.exp(c[3])-q[:,2]
 if np.any(d<.05): raise ValueError('Camera intersects head')
 return np.column_stack((512+FOCAL*q[:,0]/d,512-FOCAL*q[:,1]/d))

def solve(fun,x,lo,hi,iterations):
 x=np.clip(x,lo,hi);lam=.03;r=fun(x);history=[]
 for step in range(iterations):
  if time.monotonic()-START>60:raise TimeoutError('60-second CPU budget reached')
  j=np.empty((len(r),len(x)))
  for k in range(len(x)):
   h=1e-5; xx=x.copy();xx[k]+=h;j[:,k]=(fun(xx)-r)/h
  hessian=j.T@j; delta=np.linalg.solve(hessian+lam*np.diag(np.maximum(np.diag(hessian),1)), -j.T@r)
  trial=np.clip(x+delta,lo,hi)
  try:
   rr=fun(trial)
   if not np.isfinite(rr).all():raise ValueError('Non-finite trial')
  except (ValueError,FloatingPointError):
   lam=min(lam*5,1e8);history.append({'iteration':step,'objective':float(r@r),'improved':False,'invalidTrial':True});continue
  improved=float(rr@rr)<float(r@r)
  history.append({'iteration':step,'objective':float(r@r),'improved':improved})
  if improved:
   improvement=float(r@r-rr@rr);x,r=trial,rr;lam=max(lam/3,1e-7)
   if improvement<1e-7 or np.linalg.norm(delta)<1e-7:break
  else:lam=min(lam*5,1e8)
 return x,history

if __name__=='__main__':
 if sys.argv[1:]!=['--camera-only']:raise SystemExit('Only explicit --camera-only supported until contour preflight passes')
 result={'stage':'camera-initialization-only','center':CENTER.tolist(),'fov':28,'identity':{},'views':{},'limits':['Native identity and expression unchanged. Camera alignment is not a likeness candidate.','Fixed focal length; angles and distance bounded. Generated-image cameras remain estimated.']}
 for view,yaw,dist in [('front',0,.5),('angle',-.26,.7)]:
  anchors=[a for a in data['anchors'] if a['name'] in data['observations'][view]];p=points(base,anchors)
  target=np.array([data['observations'][view][a['name']] for a in anchors]);sigma=np.array([a['uncertaintyPixels'] for a in anchors])[:,None]
  x=np.array([yaw,0,0,np.log(dist),0,0]);initial=x.copy()
  lo=np.array([-.18 if view=='front' else -.6,-.21,-.14,np.log(.25),-.1,-.12]);hi=np.array([.18 if view=='front' else -.03,.21,.14,np.log(1.2),.1,.12])
  def residual(c):return np.r_[((project(p,c)-target)/sigma).ravel(),(c[:3]-initial[:3])/np.array([.3,.25,.2])]
  c,h=solve(residual,x,lo,hi,35);pred=project(p,c)
  result['views'][view]={'camera':c.tolist(),'rmsPixels':float(np.sqrt(np.mean(np.sum((pred-target)**2,axis=1)))),'history':h,'projected':{a['name']:q.tolist() for a,q in zip(anchors,pred)}}
 result['seconds']=time.monotonic()-START
 (OUT/'camera-initialization.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({v:{'rmsPixels':r['rmsPixels'],'camera':r['camera']} for v,r in result['views'].items()}))
