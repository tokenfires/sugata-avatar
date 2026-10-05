"""Original fictional unitless boot source. No body, image measurement or importer."""
from pathlib import Path
import collections
import json
import math

BASE = Path(__file__).resolve().parent
OUT = BASE / 'export'
positions, labels, faces, face_parts, parts = [], [], [], [], []
N = 32
# Y, half width, rear Z, toe Z. Deliberate original artist dimensions.
SECTIONS = [(.14,.40,-.55,1.30),(.22,.42,-.56,1.29),(.36,.41,-.55,1.18),
            (.52,.35,-.53,.92),(.69,.27,-.51,.40),(.84,.235,-.50,.20),
            (1.01,.24,-.49,.21),(1.20,.25,-.47,.23)]


def vertex(name, xyz):
    labels.append(name)
    positions.append([round(float(x), 8) for x in xyz])
    return len(positions)-1


def triangle(part, a, b, c):
    faces.append([a,b,c]); face_parts.append(part)


def quad(part, a, b, c, d):
    triangle(part,a,b,c); triangle(part,a,c,d)


def point(section, angle, radial=1):
    y,w,rear,toe = section
    center,depth = (rear+toe)/2,(toe-rear)/2
    return [w*math.sin(angle)*(1+.10*math.cos(angle))*radial,y,
            center+depth*math.cos(angle)*radial]


def ring(part, name, points):
    return [vertex(f'left.{part}.{name}.{i}',p) for i,p in enumerate(points)]


def bridge(part, a, b):
    assert len(a)==len(b)
    for i in range(len(a)):
        j=(i+1)%len(a);quad(part,a[i],a[j],b[j],b[i])


def cap(part, name, loop):
    center=[sum(positions[v][k] for v in loop)/len(loop) for k in range(3)]
    v=vertex(f'left.{part}.{name}.center',center)
    for i in range(len(loop)):triangle(part,v,loop[i],loop[(i+1)%len(loop)])


def begin(name, role, color, visible=True):
    return {'id':name,'role':role,'side':'left','color':color,'visible':visible,
            'first_vertex':len(positions),'first_face':len(faces)}


def finish(p, joins=None):
    p['vertex_ids']=list(range(p.pop('first_vertex'),len(positions)))
    p['face_ids']=list(range(p.pop('first_face'),len(faces)))
    p['named_interfaces']=joins or {}
    parts.append(p)


def closed_loft(name,role,sections,color,visible=True):
    p=begin(name,role,color,visible)
    rings=[ring(name,f'ring.{i}',[point(s,2*math.pi*j/N) for j in range(N)])
           for i,s in enumerate(sections)]
    for a,b in zip(rings,rings[1:]):bridge(name,a,b)
    cap(name,'lower',rings[0]);cap(name,'upper',rings[-1])
    finish(p,{'lower':rings[0],'upper':rings[-1],'section_rings':rings})


upper=begin('upper','upper_shell','#825734')
outer=[ring('upper',f'outer.{i}',[point(s,2*math.pi*j/N) for j in range(N)])
       for i,s in enumerate(SECTIONS)]
INNER=[(y if i else .18,w-.045,rear+.04,toe-.04)
       for i,(y,w,rear,toe) in enumerate(SECTIONS)]
inner=[ring('upper',f'inner.{i}',[point(s,2*math.pi*j/N) for j in range(N)])
       for i,s in enumerate(INNER)]
for a,b in zip(outer,outer[1:]):bridge('upper',a,b)
for a,b in zip(inner,inner[1:]):bridge('upper',a,b)
bridge('upper',outer[-1],inner[-1])
cap('upper','bottom',outer[0]);cap('upper','inner_floor',inner[0])
finish(upper,{'outer_bottom':outer[0],'inner_floor':inner[0],
              'rim_outer':outer[-1],'rim_inner':inner[-1],
              'outer_section_rings':outer,'inner_section_rings':inner})

# Closed fictional reference, with intentional ankle continuation above the rim.
# It is source authorship, not anatomical partition or a physical shoemaking last.
NOMINAL=[(y+.025 if i==0 else (1.29 if i==len(INNER)-1 else y),w*.88,rear+.04,toe-.04)
         for i,(y,w,rear,toe) in enumerate(INNER)]
closed_loft('nominal','fictional_reference',NOMINAL,'#a0b5ad',False)

sole=begin('sole','sole','#3b3028')
sole_section=(.14,.425,-.58,1.33)
top=[point(sole_section,2*math.pi*j/N) for j in range(N)]
bottom=[]
for xyz in top:
    z=xyz[2]
    y=.10 if z<=.40 else max(.035,.10-(z-.40)*.10)
    bottom.append([xyz[0],y,z])
sole_lower=ring('sole','lower',bottom);sole_upper=ring('sole','upper',top)
bridge('sole',sole_lower,sole_upper);cap('sole','bottom',sole_lower);cap('sole','top',sole_upper)
finish(sole,{'lower':sole_lower,'upper':sole_upper})
closed_loft('heel','heel',[(0,.23,-.53,-.12),(.105,.23,-.53,-.12)],'#49382c')


def section_at(y):
    if y<=SECTIONS[0][0]:return SECTIONS[0]
    if y>=SECTIONS[-1][0]:return (y,*SECTIONS[-1][1:])
    for a,b in zip(SECTIONS,SECTIONS[1:]):
        if a[0]<=y<=b[0]:
            t=(y-a[0])/(b[0]-a[0]);return tuple(a[k]+t*(b[k]-a[k]) for k in range(4))
    raise AssertionError('Unowned section')


def panel(name,role,ys,xwidth,zfront,zback,color):
    p=begin(name,role,color);rows=[]
    for i,y in enumerate(ys):
        rows.append(ring(name,f'ring.{i}',[[-xwidth(y),y,zback(y)],
                     [xwidth(y),y,zback(y)],[xwidth(y),y,zfront(y)],[-xwidth(y),y,zfront(y)]]))
    for a,b in zip(rows,rows[1:]):bridge(name,a,b)
    cap(name,'lower',rows[0]);cap(name,'upper',rows[-1]);finish(p,{'lower':rows[0],'upper':rows[-1]})


panel('tongue','tongue_front_facing',[.46,.52,.69,.84,1.01,1.25],
      lambda y:.105+.045*(y-.46)/.79,
      lambda y:section_at(y)[3]+.038,lambda y:section_at(y)[3]+.018,'#64432f')
panel('rear_strip','rear_strip',[.22,.36,.52,.69,.84,1.01,1.20],lambda y:.034,
      lambda y:section_at(y)[2]-.005,lambda y:section_at(y)[2]-.030,'#563924')

counter=begin('counter','counter','#946344')
counter_rows=[]
for i,y in enumerate([.22,.36,.52,.69]):
    section=section_at(y)
    angles=[2*math.pi/3+j*(2*math.pi/3)/16 for j in range(17)]
    # Each row is a closed strip cross-section: outer arc followed by inner arc.
    arc=[point(section,t,1.035) for t in angles]+[point(section,t,1.005) for t in angles[::-1]]
    counter_rows.append(ring('counter',f'ring.{i}',arc))
for a,b in zip(counter_rows,counter_rows[1:]):bridge('counter',a,b)
# Concave arc-strip ends are paired quads; a center fan would cross the empty arc.
for row in [counter_rows[0],counter_rows[-1]]:
    for j in range(16):quad('counter',row[j],row[j+1],row[32-j],row[33-j])
finish(counter,{'lower':counter_rows[0],'upper':counter_rows[-1]})


def tube(name,a,b,radius):
    p=begin(name,'lace','#c6a17f')
    delta=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(x*x for x in delta))
    axis=[x/length for x in delta]
    horizontal=math.hypot(axis[0],axis[2]);assert horizontal>0
    u=[axis[2]/horizontal,0,-axis[0]/horizontal]
    v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]]
    loops=[]
    for i,end in enumerate([a,b]):
        loops.append(ring(name,f'ring.{i}',[[end[k]+radius*(math.cos(t)*u[k]+math.sin(t)*v[k])
                     for k in range(3)] for t in [2*math.pi*j/10 for j in range(10)]]))
    bridge(name,*loops);cap(name,'start',loops[0]);cap(name,'end',loops[1]);finish(p)


for row,y in enumerate([.56,.66,.76,.86,.96,1.06]):
    y2=y+.085
    for cross in [0,1]:
        sign=1 if cross==0 else -1
        tube(f'lace.{row}.{cross}',[-sign*.13,y,section_at(y)[3]+.067],
             [sign*.13,y2,section_at(y2)[3]+.067],.016)

# Orient every original closed part through shared edges, then its signed volume.
# No geometry trial or prior-candidate correction is used by this literal source.
for p in parts:
    edge=collections.defaultdict(list)
    for fi in p['face_ids']:
        f=faces[fi]
        for a,b in zip(f,f[1:]+f[:1]):edge[tuple(sorted((a,b)))].append((fi,a,b))
    assert all(len(es)==2 for es in edge.values()),p['id']
    adjacency=collections.defaultdict(list)
    for es in edge.values():
        (a,aa,ab),(b,ba,bb)=es;same=(aa,ab)==(ba,bb)
        adjacency[a].append((b,same));adjacency[b].append((a,same))
    flips={p['face_ids'][0]:False};queue=collections.deque(flips)
    while queue:
        a=queue.popleft()
        for b,same in adjacency[a]:
            value=flips[a]^same
            if b in flips:assert flips[b]==value,p['id']
            else:flips[b]=value;queue.append(b)
    assert len(flips)==len(p['face_ids']),p['id']
    for fi,value in flips.items():
        if value:faces[fi].reverse()
    volume=0
    for fi in p['face_ids']:
        a,b,c=[positions[v] for v in faces[fi]]
        volume+=sum(a[k]*(b[(k+1)%3]*c[(k+2)%3]-b[(k+2)%3]*c[(k+1)%3]) for k in range(3))/6
    assert abs(volume)>1e-10,p['id']
    if volume<0:
        for fi in p['face_ids']:faces[fi].reverse()

left_count=len(positions);left_faces=len(faces);left_parts=list(parts)
for xyz in positions:xyz[0]=round(xyz[0]-.62,8)
for i in range(left_count):vertex(labels[i].replace('left.','right.',1),[-positions[i][0],positions[i][1],positions[i][2]])
for i in range(left_faces):
    name='right.'+face_parts[i];face_parts[i]='left.'+face_parts[i]
    faces.append([v+left_count for v in faces[i][::-1]]);face_parts.append(name)
for p in left_parts:
    original=p['id'];p['id']='left.'+original
    q=json.loads(json.dumps(p));q['id']='right.'+original;q['side']='right'
    q['vertex_ids']=[v+left_count for v in p['vertex_ids']]
    q['face_ids']=[fi+left_faces for fi in p['face_ids']]
    def shift(value):
        if isinstance(value,list):return [shift(v) for v in value]
        return value+left_count
    q['named_interfaces']={k:shift(v) for k,v in p['named_interfaces'].items()}
    parts.append(q)

mesh={'title':'Original paired lace-up ankle-boot blockout','units':'unitless',
      'axes':{'X':'lateral','Y':'up','Z':'toe-forward'},'positions':positions,
      'vertex_labels':labels,'triangles':faces,'face_parts':face_parts,'parts':parts,
      'pair':{'left_vertex_count':left_count,'left_face_count':left_faces,
              'left_offset_x':-.62,'right':'Reflect final left X and reverse each triangle'},
      'nominal_interface':{'role':'fictional_reference','sections_left_local':NOMINAL,
          'responsibility':'Complete fictional foot/ankle envelope; upper cavity and floor authored independently; top continues toY1.29 above rimY1.20. No anatomical or continuous enclosure qualification.'},
      'contact_intent':['Upper bottom and sole upper useY.14, separate closed components, no Boolean union.',
          'Heel topY.105 overlaps rear sole bottomY.10 by.005 as artist seating intent.',
          'Tongue/front facing, counter and rear strip are separate closed overlays on the continuous upper.',
          'Lace cylinders cross as decorative separate components; their crossings overlap intentionally.'],
      'limits':['Original fictional unitless choices; no image dimensions or human-foot source recovered',
          'Coarse artist source, no physical last/fit/material-finish/rig/morph/pose/motion/AAA qualification',
          'Closed per-part topology is not general self-intersection, inter-part contact or continuous cavity/enclosure proof']}
assert not OUT.exists(),'Refuse overwrite or second export'
OUT.mkdir();(OUT/'mesh.json').write_text(json.dumps(mesh,indent=2)+'\n')
for filename,reference in [('boots.obj',False),('nominal-reference.obj',True)]:
    obj=['# Original fictional unitless boot source; '+('nominal reference only' if reference else 'artist boot parts')]
    obj+=['v '+' '.join(f'{x:.8f}' for x in xyz) for xyz in positions]
    for p in parts:
        if (p['role']=='fictional_reference')!=reference:continue
        obj.append('g '+p['id'])
        obj+=['f '+' '.join(str(v+1) for v in faces[fi]) for fi in p['face_ids']]
    (OUT/filename).write_text('\n'.join(obj)+'\n')
print(json.dumps({'vertices':len(positions),'triangles':len(faces),'parts':len(parts),
                  'scope':'Original fictional unitless paired artist source only'}))
