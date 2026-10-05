"""Original authored head. Inert until exact external admission; stdlib only."""
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import time

BASE = Path(__file__).resolve().parent
OUT = BASE / 'output'
SOURCE_FILES = ['SOURCE.json', 'SOURCE-CONTRACT.md', 'AUTHORING-ADDENDUM.md',
                'CAP-ORIENTATION-ADDENDUM.md']


def pin(path):
    b = path.read_bytes()
    return {'path': path.name, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}


def put(name, b):
    with (OUT / name).open('xb') as f:
        f.write(b)
    return pin(OUT / name)


def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]


def main():
    start = time.time()
    source = json.loads((BASE / 'SOURCE.json').read_text())
    OUT.mkdir(exist_ok=False)
    names = list(source['materials'])
    parts = []

    def new_part(name):
        part = dict(name=name, positions=[], ids=[], triangles=[], face_materials=[], rims={})
        parts.append(part)
        return part

    def vertex(part, xyz, identity):
        i = len(part['positions'])
        part['positions'].append([f32(v) for v in xyz])
        part['ids'].append(identity)
        return i

    def face(part, tri, material):
        part['triangles'].append(list(tri))
        part['face_materials'].append(names.index(material))

    profile = source['profile']

    def scalar(y, column):
        if y == profile[0][0]:
            return profile[0][column]
        if y == profile[-1][0]:
            return profile[-1][column]
        for i in range(len(profile)-1):
            ya, yb = profile[i][0], profile[i+1][0]
            if ya <= y <= yb:
                def slope(k):
                    left, right = max(0, k-1), min(len(profile)-1, k+1)
                    return ((profile[right][column]-profile[left][column]) /
                            (profile[right][0]-profile[left][0]))
                h = yb-ya
                t = (y-ya)/h
                a, b = profile[i][column], profile[i+1][column]
                v = ((2*t**3-3*t*t+1)*a + (t**3-2*t*t+t)*h*slope(i) +
                     (-2*t**3+3*t*t)*b + (t**3-t*t)*h*slope(i+1))
                if not math.isfinite(v) or v < 0:
                    raise ValueError(('invalid profile', y, column, v))
                return v
        raise ValueError(('outside profile', y))

    features = source['facial_features']
    feature_order = ['nose_bridge', 'nose_tip', 'alar_wings', 'nostril_recesses',
                     'cheeks', 'chin', 'brow_ridges', 'eye_socket_recesses']

    def sculpt(x, y):
        total = 0.0
        for name in feature_order:
            item = features[name]
            centres = item['centres'] if 'centres' in item else [item['centre']]
            sx, sy = item['sigma']
            for cx, cy in centres:
                total += item['height']*math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)
        lip = features['lip_model']
        seam = -.275-.004*(x/.17)**2
        sx, sy = lip['sigma']
        for key, offset in [('upper_lip_height','upper_offset_y'),
                            ('lower_lip_height','lower_offset_y')]:
            total += lip[key]*math.exp(-(x/sx)**2-((y-(seam+lip[offset]))/sy)**2)
        sx, sy = lip['seam_sigma']
        total += lip['seam_recess_height']*math.exp(-(x/sx)**2-((y-seam)/sy)**2)
        return total

    def face_z(x, y):
        width = scalar(y, 1)
        if width <= 0 or abs(x/width) > 1:
            raise ValueError(('invalid front branch', x, y, width))
        alpha = math.asin(x/width)
        c = math.cos(alpha)
        return scalar(y, 2)*c+c**4*sculpt(x, y)

    skin = new_part('Skin')
    grid = {}
    patches = source['eyes']['patches']
    boundary = {}
    perimeters = {}
    for patch in patches:
        lo, hi, bottom, top = [patch[k] for k in ['u_min','u_max','j_min','j_max']]
        perimeter = ([(bottom,u) for u in range(lo,hi+1)] +
                     [(j,hi) for j in range(bottom+1,top+1)] +
                     [(top,u) for u in range(hi-1,lo-1,-1)] +
                     [(j,lo) for j in range(top-1,bottom,-1)])
        perimeters[patch['name']] = perimeter
        cx, cy = patch['centre']
        rx, ry = source['eyes']['rim_radii']
        for j, u in perimeter:
            angle = math.atan2((j-(bottom+top)/2)/((top-bottom)/2),
                               (u-(lo+hi)/2)/((hi-lo)/2))
            x, y = cx+rx*math.cos(angle), cy+ry*math.sin(angle)
            s = math.sin(angle)
            z = face_z(x,y)+.020*max(s,0)**2+.006*max(-s,0)**2
            boundary[(j,u)] = (x,y,z)

    n, rows = source['grid']['azimuth_steps'], source['grid']['height_steps']
    ear = source['ears']
    for j in range(rows):
        y = source['grid']['min_y'] + (source['grid']['max_y']-source['grid']['min_y'])*j/rows
        for u in range(n):
            if any(p['j_min'] < j < p['j_max'] and p['u_min'] < u < p['u_max'] for p in patches):
                continue
            if (j,u) in boundary:
                xyz = boundary[(j,u)]
            else:
                phi = 2*math.pi*u/n
                s, c = math.sin(phi), math.cos(phi)
                x = scalar(y,1)*s
                ear_sum = 0.0
                for ep in [math.pi/2,3*math.pi/2]:
                    delta = (phi-ep+math.pi) % (2*math.pi)-math.pi
                    ear_sum += ear['outer_radial_extension']*math.exp(
                        -((y-ear['centre_y'])/ear['height_sigma'])**4-
                        (delta/ear['azimuth_sigma'])**4)
                    ear_sum += ear['inner_fold_extension']*math.exp(
                        -((y-ear['inner_centre_y'])/ear['inner_height_sigma'])**4-
                        (delta/ear['inner_azimuth_sigma'])**4)
                x += (1 if s > 0 else -1 if s < 0 else 0)*ear_sum
                z = scalar(y,2 if c >= 0 else 3)*c+max(c,0)**4*sculpt(x,y)
                xyz = (x,y,z)
            grid[(j,u)] = vertex(skin,xyz,f'grid:{j}:{u}')

    def skin_face(tri, force=None):
        xyz = [sum(skin['positions'][i][k] for i in tri)/3 for k in range(3)]
        x,y,z = xyz
        material = 'Skin'
        if z > 0 and abs(abs(x)-.225) < .15 and abs(y-(.405-.055*((abs(x)-.225)/.15)**2)) < .014:
            material = 'Brow'
        elif z > 0 and (x/.18)**2+((y+.275)/.054)**2 < 1:
            material = 'Lips'
        face(skin,tri,force or material)

    for j in range(rows-1):
        for u in range(n):
            if any(p['j_min'] <= j and j+1 <= p['j_max'] and p['u_min'] <= u and u+1 <= p['u_max'] for p in patches):
                continue
            v = (u+1)%n
            a,b,c,d = [grid[k] for k in [(j,u),(j,v),(j+1,u),(j+1,v)]]
            skin_face((a,b,d)); skin_face((a,d,c))
    bottom = vertex(skin,(0,-1.1,0),'bottom-pole')
    top = vertex(skin,(0,1.1,0),'top-pole')
    for u in range(n):
        v = (u+1)%n
        skin_face((bottom,grid[(0,v)],grid[(0,u)]),'Skin')
        skin_face((grid[(rows-1,u)],grid[(rows-1,v)],top),'Skin')
    for patch in patches:
        name = patch['name']; cx,cy = patch['centre']
        keys = perimeters[name]
        rim = [grid[k] for k in keys]
        back = []
        for k,(j,u) in enumerate(keys):
            angle = math.atan2((j-(patch['j_min']+patch['j_max'])/2)/((patch['j_max']-patch['j_min'])/2),
                               (u-(patch['u_min']+patch['u_max'])/2)/((patch['u_max']-patch['u_min'])/2))
            back.append(vertex(skin,(cx+.145*math.cos(angle),cy+.132*math.sin(angle),.23),f'cup:{name}:{k}'))
        centre = vertex(skin,(cx,cy,.23),f'cup:{name}:centre')
        skin['rims'][name] = dict(rim=rim, back=back, centre=centre,
                                  source_grid_ids=[skin['ids'][i] for i in rim])
        for k in range(len(rim)):
            nxt = (k+1)%len(rim)
            for tri in [(rim[k],rim[nxt],back[nxt]),(rim[k],back[nxt],back[k]),(back[k],back[nxt],centre)]:
                skin_face(tri,'Skin')

    eye = source['eyes']['companion']
    for name,centre in zip(['EyeLeft','EyeRight'],eye['centres']):
        part = new_part(name); rings = {}; theta_by_id=[]
        cx,cy,cz=centre; rx,ry,rz=eye['radii']; az=eye['azimuth_steps']; pol=eye['polar_steps']
        def eye_vertex(xyz,identity,theta):
            i=vertex(part,xyz,identity);theta_by_id.append(theta);return i
        front=eye_vertex((cx,cy,cz+rz),'front-pole',0)
        for j in range(1,pol):
            theta=j*math.pi/pol
            for u in range(az):
                beta=2*math.pi*u/az
                rings[(j,u)]=eye_vertex((cx+rx*math.sin(theta)*math.cos(beta),
                    cy+ry*math.sin(theta)*math.sin(beta),cz+rz*math.cos(theta)),f'eye:{j}:{u}',theta)
        rear=eye_vertex((cx,cy,cz-rz),'rear-pole',math.pi)
        def eye_face(tri):
            theta=sum(theta_by_id[i] for i in tri)/3
            cut=eye['material_theta_cutoffs_radians']
            face(part,tri,'Pupil' if theta<=cut['pupil'] else 'Iris' if theta<=cut['iris'] else 'Sclera')
        for j in range(1,pol-1):
            for u in range(az):
                v=(u+1)%az
                a,b,c,d=[rings[k] for k in [(j,u),(j,v),(j+1,u),(j+1,v)]]
                eye_face((a,c,d));eye_face((a,d,b))
        for u in range(az):
            v=(u+1)%az
            eye_face((front,rings[(1,u)],rings[(1,v)]))
            eye_face((rings[(pol-1,u)],rear,rings[(pol-1,v)]))

    files=[]
    obj=['mtllib neutral-head.mtl']
    offset=0
    for part in parts:
        xyz=part['positions']; accum=[[0.,0.,0.] for _ in xyz]
        for a,b,c in part['triangles']:
            ab=[xyz[b][k]-xyz[a][k] for k in range(3)];ac=[xyz[c][k]-xyz[a][k] for k in range(3)]
            cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
            for i in [a,b,c]:
                for k in range(3):accum[i][k]+=cross[k]
        normals=[]
        for i,v in enumerate(accum):
            length=math.sqrt(sum(t*t for t in v))
            if not math.isfinite(length) or length <= 0:raise ValueError(('zero/nonfinite normal',part['name'],i))
            normals.append([f32(t/length) for t in v])
        part['normals']=normals
        for field,fmt,ext in [('positions','f','f32'),('normals','f','f32'),('triangles','I','u32')]:
            values=[v for row in part[field] for v in row]
            filename=f"{part['name']}-{field}.{ext}"
            files.append(put(filename,struct.pack('<'+fmt*len(values),*values)))
        obj.append('o '+part['name']);obj.append('g '+part['name'])
        for v in xyz:obj.append('v '+' '.join(format(x,'.9g') for x in v))
        for v in normals:obj.append('vn '+' '.join(format(x,'.9g') for x in v))
        previous=None
        for tri,mat in zip(part['triangles'],part['face_materials']):
            if mat!=previous:obj.append('usemtl '+names[mat]);previous=mat
            obj.append('f '+' '.join(f'{i+offset+1}//{i+offset+1}' for i in tri))
        offset+=len(xyz)
    mtl=[]
    for name,material in source['materials'].items():
        colour=material['colour'][1:]
        rgb=[int(colour[k:k+2],16)/255 for k in [0,2,4]]
        mtl.extend(['newmtl '+name,'Kd '+' '.join(format(v,'.17g') for v in rgb),
                    'd 1','Pr '+str(material['roughness'])])
    files.append(put('neutral-head.obj',('\n'.join(obj)+'\n').encode()))
    files.append(put('neutral-head.mtl',('\n'.join(mtl)+'\n').encode()))
    mesh=dict(schema='sugata-original-neutral-head-mesh-v1', source_inputs=[pin(BASE/n) for n in SOURCE_FILES],
              materials=source['materials'],material_order=names,feature_owners={n:'Skin' for n in feature_order+['lip_model','ears','rear','neck']},
              parts=parts,files=files,limits='Original static artist source. No self-intersection/embedding/anatomy/fit/rig/motion certificate.')
    files_out=files+[put('mesh.json',(json.dumps(mesh,separators=(',',':'),allow_nan=False)+'\n').encode())]
    put('BUILD.json',(json.dumps(dict(started_unix=start,ended_unix=time.time(),pid=os.getpid(),
         decision='exports emitted; independent saved-file gate still required',inputs=mesh['source_inputs'],outputs=files_out),indent=2)+'\n').encode())
    print(json.dumps({'event':'build complete','pid':os.getpid(),'outputs':files_out}))


if __name__ == '__main__':
    main()
