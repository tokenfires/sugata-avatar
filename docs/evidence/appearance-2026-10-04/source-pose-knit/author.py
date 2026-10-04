"""One fixed world-space artist volume. No fit, prior mesh or body decode."""
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SIDES = [
    ((-1,0,0), ((0,0,0),(0,0,1),(0,1,1),(0,1,0))),
    ((1,0,0), ((1,0,0),(1,1,0),(1,1,1),(1,0,1))),
    ((0,-1,0), ((0,0,0),(1,0,0),(1,0,1),(0,0,1))),
    ((0,1,0), ((0,1,0),(0,1,1),(1,1,1),(1,1,0))),
    ((0,0,-1), ((0,0,0),(0,1,0),(1,1,0),(1,0,0))),
    ((0,0,1), ((0,0,1),(1,0,1),(1,1,1),(0,1,1))),
]

def utc(): return datetime.now(timezone.utc).isoformat()
def save(name, value):
    (HERE/name).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')
def sub(a,b): return [a[i]-b[i] for i in range(3)]
def dot(a,b): return math.fsum(a[i]*b[i] for i in range(3))
def mean(ps): return [math.fsum(p[i] for p in ps)/len(ps) for i in range(3)]
def edge(a,b): return tuple(sorted((a,b)))

class Refusal(Exception):
    def __init__(self,label,witness):
        super().__init__(label); self.witness=witness
def require(ok,label,witness):
    if not ok: raise Refusal(label,witness)

def section(y,c):
    rows=c['torso']['sections']
    for a,b in zip(rows,rows[1:]):
        if a[0]<=y<=b[0]:
            t=(y-a[0])/(b[0]-a[0])
            return [a[i]+t*(b[i]-a[i]) for i in (1,2,3)]
    return None

def sleeve_controls(c,sign):
    return [[sign*p[0],p[1],p[2]] for p in c['positiveSleeve']['centres']]

def sleeve_inside(p,c,sign):
    ps=sleeve_controls(c,sign);rs=c['positiveSleeve']['radii']
    for i,(a,b) in enumerate(zip(ps,ps[1:])):
        d=sub(b,a);v=sub(p,a);t=dot(v,d)/dot(d,d)
        if 0<=t<=1:
            radial=[v[k]-t*d[k] for k in range(3)]
            radius=rs[i]+t*(rs[i+1]-rs[i])
            if dot(radial,radial)<=radius*radius: return True
    return False

def neck_void(p,c):
    n=c['neckVoid'];x,z=n['centerXZ'];rx,rz=n['radiiXZ']
    return p[1]>=n['yMin'] and ((p[0]-x)/rx)**2+((p[2]-z)/rz)**2<=1

def field_bits(p,c):
    torso=False;row=section(p[1],c)
    if row is not None and p[1]<=c['torso']['yMax']-c['torso']['shoulderSlope']*abs(p[0]):
        width,back,front=row;cz=(back+front)/2;depth=(front-back)/2
        torso=(p[0]/width)**2+((p[2]-cz)/depth)**2<=1
    return int(torso)+2*int(sleeve_inside(p,c,-1))+4*int(sleeve_inside(p,c,1))+8*int(neck_void(p,c))

def cut_roles(outside,c):
    roles=[]
    if outside[1]<c['torso']['yMin']: roles.append('hem')
    if neck_void(outside,c): roles.append('neck')
    for sign,name in [(-1,'negative-X-cuff'),(1,'positive-X-cuff')]:
        ps=sleeve_controls(c,sign);v=sub(outside,ps[-1]);d=sub(ps[-1],ps[-2])
        if dot(v,d)>0 and dot(v,v)<=c['cuffRoleReach']**2: roles.append(name)
    return roles

def incidence(faces):
    es=defaultdict(list)
    for fi,f in enumerate(faces):
        for i,a in enumerate(f):
            b=f[(i+1)%4];es[edge(a,b)].append((fi,a,b))
    return dict(es)

def connected(graph,start):
    seen={start};todo=[start]
    while todo:
        for n in graph[todo.pop()]:
            if n not in seen: seen.add(n);todo.append(n)
    return seen

def validate(points,faces,roles,expected,c,label):
    require(bool(faces),label+' empty faces',{})
    require(all(len(f)==4 and len(set(f))==4 for f in faces),label+' quad uniqueness',{})
    require(all(math.isfinite(v) for p in points for v in p),label+' finite coordinates',{})
    es=incidence(faces);used={v for f in faces for v in f};graph=defaultdict(set)
    boundary=defaultdict(set);links=defaultdict(lambda:defaultdict(set))
    for e,rows in es.items():
        require(len(rows)<=2,label+' edge manifold',{'edge':e,'rows':rows})
        if len(rows)==2: require(rows[0][1:]==rows[1][1:][::-1],label+' orientation',{'edge':e,'rows':rows})
        else:
            require(e in roles,label+' unnamed boundary',{'edge':e})
            boundary[e[0]].add(e[1]);boundary[e[1]].add(e[0])
        graph[e[0]].add(e[1]);graph[e[1]].add(e[0])
    require(connected(graph,min(used))==used,label+' connected',{'vertices':len(used)})
    require(all(len(ns)==2 for ns in boundary.values()),label+' simple boundary degree',{'bad':[(v,list(ns)) for v,ns in boundary.items() if len(ns)!=2]})
    minarea=math.inf
    for fi,f in enumerate(faces):
        for i,v in enumerate(f):
            a,b=f[(i-1)%4],f[(i+1)%4];links[v][a].add(b);links[v][b].add(a)
        for tri in [(f[0],f[1],f[2]),(f[0],f[2],f[3])]:
            a,b,z=[points[v] for v in tri];u=sub(b,a);v=sub(z,a)
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            area=math.hypot(*cross)/2;minarea=min(minarea,area)
            require(area>c['minimumTriangleArea'],label+' collapsed triangle',{'face':fi,'triangle':tri,'points':[a,b,z],'area':area})
    for v,link in links.items():
        degrees=sorted(len(ns) for ns in link.values())
        require(connected(link,min(link))==set(link),label+' vertex link connected',{'vertex':v,'link':{k:sorted(ns) for k,ns in link.items()}})
        ok=(degrees.count(1)==2 and all(x in (1,2) for x in degrees)) if v in boundary else all(x==2 for x in degrees)
        require(ok,label+' vertex link manifold',{'vertex':v,'degrees':degrees})
    cycles=[];pending=set(boundary)
    while pending:
        start=min(pending);walk=[start];prior=None;current=start
        while True:
            choices=sorted(boundary[current]-({prior} if prior is not None else set()))
            nxt=choices[0]
            if nxt==start: break
            require(nxt not in walk,label+' boundary revisits',{'walk':walk,'next':nxt})
            walk.append(nxt);prior,current=current,nxt
        pending-=set(walk)
        names={roles[edge(a,walk[(i+1)%len(walk)])] for i,a in enumerate(walk)}
        require(len(names)==1,label+' mixed boundary roles',{'walk':walk,'roles':sorted(names)})
        cycles.append({'role':next(iter(names)),'vertices':walk})
    require(sorted(x['role'] for x in cycles)==sorted(expected),label+' four role cycles',{'cycles':cycles})
    euler=len(used)-len(es)+len(faces);target=2 if not expected else c['requiredEuler']
    require(euler==target,label+' Euler',{'V':len(used),'E':len(es),'F':len(faces),'Euler':euler,'target':target})
    return {'V':len(used),'E':len(es),'F':len(faces),'Euler':euler,'cycles':cycles,'minimumTriangleArea':minarea,'edgeAndVertexManifold':True,'connectedOrientable':True}

def smooth(points,faces,roles):
    es=incidence(faces);fps=[mean([points[v] for v in f]) for f in faces]
    vfs=defaultdict(list);ves=defaultdict(list);boundary=set()
    for fi,f in enumerate(faces):
        for v in f:vfs[v].append(fi)
    for e,rows in es.items():
        for v in e:ves[v].append(e)
        if len(rows)==1:boundary.update(e)
    out=[]
    for v,p in enumerate(points):
        if v in boundary:out.append(p[:]);continue
        n=len(vfs[v]);f=mean([fps[i] for i in vfs[v]]);r=mean([mean([points[a],points[b]]) for a,b in ves[v]])
        out.append([(f[k]+2*r[k]+(n-3)*p[k])/n for k in range(3)])
    eids={}
    for e,rows in es.items():
        eids[e]=len(out);out.append(mean([points[e[0]],points[e[1]]]+([fps[x[0]] for x in rows] if len(rows)==2 else [])))
    fids=[]
    for p in fps:fids.append(len(out));out.append(p)
    children=[]
    for fi,f in enumerate(faces):
        for i,v in enumerate(f):children.append([v,eids[edge(v,f[(i+1)%4])],fids[fi],eids[edge(f[(i-1)%4],v)]])
    newroles={}
    for (a,b),name in roles.items():
        newroles[edge(a,eids[edge(a,b)])]=name;newroles[edge(eids[edge(a,b)],b)]=name
    return out,children,newroles

def run():
    c=json.loads((HERE/'ARTIST.json').read_text());raw={'started':utc(),'pid':os.getpid(),'artist':c};job={'started':raw['started'],'pid':os.getpid(),'maximumInvocations':1}
    try:
        require(datetime.now(timezone.utc)<datetime.fromisoformat(c['authorGateUTC'].replace('Z','+00:00')),'author cutoff',{'utc':utc()})
        inputs=json.loads((HERE/'INPUTS.json').read_text())
        for name,pin in inputs['files'].items():
            b=(ROOT/name).read_bytes();require(len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],'input changed',{'path':name})
        g=c['grid'];origin=g['origin'];h=g['spacing'];nx,ny,nz=g['counts'];cells=set();bits=[]
        for i in range(nx):
            for j in range(ny):
                for k in range(nz):
                    p=[origin[t]+h*((i,j,k)[t]+.5) for t in range(3)];value=field_bits(p,c);bits.append(format(value,'x'))
                    if value&7 and not value&8:cells.add((i,j,k))
        raw.update({'fieldBitsIJKOrder':''.join(bits),'insideCells':[list(x) for x in sorted(cells)]})
        require(all(0<i<nx-1 and 0<j<ny-1 and 0<k<nz-1 for i,j,k in cells),'domain border contact',{'bad':[x for x in sorted(cells) if not(0<x[0]<nx-1 and 0<x[1]<ny-1 and 0<x[2]<nz-1)]})
        ids={};points=[];closed=[];records=[]
        for cell in sorted(cells):
            for axis,offsets in SIDES:
                neighbour=tuple(cell[t]+axis[t] for t in range(3))
                if neighbour in cells:continue
                f=[]
                for offset in offsets:
                    key=tuple(cell[t]+offset[t] for t in range(3))
                    if key not in ids:ids[key]=len(points);points.append([origin[t]+h*key[t] for t in range(3)])
                    f.append(ids[key])
                q=[origin[t]+h*(neighbour[t]+.5) for t in range(3)]
                closed.append(f);records.append({'cell':cell,'axis':axis,'outsideCentre':q,'outsideBits':field_bits(q,c),'cutRoles':cut_roles(q,c)})
        raw.update({'gridVertexKeys':[list(k) for k in ids],'points':points,'closedFaces':closed,'faceOperands':records})
        raw['closedCheck']=validate(points,closed,{},[],c,'closed exterior')
        require(all(len(x['cutRoles'])<=1 for x in records),'ambiguous cut role',{'bad':[i for i,x in enumerate(records) if len(x['cutRoles'])>1]})
        faces=[f for f,x in zip(closed,records) if not x['cutRoles']];omitted=[(i,x['cutRoles'][0]) for i,x in enumerate(records) if x['cutRoles']]
        omitted_edges=defaultdict(set)
        for fi,role in omitted:
            f=closed[fi]
            for i,a in enumerate(f):omitted_edges[edge(a,f[(i+1)%4])].add(role)
        used=sorted({v for f in faces for v in f});renumber={v:i for i,v in enumerate(used)}
        cutpoints=[points[v] for v in used];cutfaces=[[renumber[v] for v in f] for f in faces];roles={}
        for e,rows in incidence(cutfaces).items():
            if len(rows)==1:
                oldedge=edge(used[e[0]],used[e[1]]);names=omitted_edges[oldedge]
                require(len(names)==1,'boundary cut ownership',{'edge':oldedge,'roles':sorted(names)})
                roles[e]=next(iter(names))
        raw.update({'omitted':omitted,'cutPoints':cutpoints,'cutFaces':cutfaces,'cutRoles':[[a,b,v] for (a,b),v in sorted(roles.items())]})
        raw['cutCheck']=validate(cutpoints,cutfaces,roles,c['roles'],c,'cut exterior')
        ps,fs,rs=smooth(cutpoints,cutfaces,roles);raw['smoothPoints']=ps;raw['smoothFaces']=fs;raw['smoothRoles']=[[a,b,v] for (a,b),v in sorted(rs.items())]
        raw['smoothCheck']=validate(ps,fs,rs,c['roles'],c,'one smooth pass')
        save('RAW.json',raw)
        mesh={'units':c['units'],'vertices':ps,'quads':fs,'boundaryRoles':raw['smoothRoles'],'artist':c,'checks':{'cut':raw['cutCheck'],'smooth':raw['smoothCheck']},'limits':'Artist source only; no fit, material, skinning, coverage or motion qualification'}
        save('mesh.json',mesh)
        obj=['# Fresh direct A-rest artist source; metre units; unqualified wearable']+['v '+' '.join(format(v,'.17g') for v in p) for p in ps]+['f '+' '.join(str(v+1) for v in f) for f in fs]
        (HERE/'sweater.obj').write_text('\n'.join(obj)+'\n')
        job.update({'status':'artist topology A; appearance unobserved','completed':utc(),'checks':mesh['checks'],'outputs':{}})
        for name in ['RAW.json','mesh.json','sweater.obj']:
            b=(HERE/name).read_bytes();job['outputs'][name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
        save('AUTHOR-JOB.json',job);print(json.dumps(job));return 0
    except Refusal as e:
        raw.update({'refused':str(e),'witness':e.witness,'completed':utc()});save('RAW.json',raw)
        job.update({'status':'B first refusal; no retry','completed':utc(),'refused':str(e),'witness':e.witness});save('AUTHOR-JOB.json',job);print(json.dumps(job));return 1

if __name__=='__main__':sys.exit(run())
