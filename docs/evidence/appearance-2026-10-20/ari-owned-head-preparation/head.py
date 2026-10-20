"""Original unitless facial artist source; execute only after the source gate.

All geometry, rendering and export code below is newly authored here. No asset,
previous producer or nonstandard dependency is loaded. The artwork is visual
intent only: no pixels/landmarks are decoded or reconstructed by this program.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

HERE = Path(__file__).resolve().parent
OUT = HERE / 'output'
N, J = 128, 89
HEIGHT = 2.30
WIDTH, IMAGE_HEIGHT = 1440, 1440
# y, half-width, half-depth, centre-z; newly authored, not measured anatomy.
SECTIONS = [
    (0.00, .36, .33, -.07), (.28, .38, .34, -.05),
    (.45, .53, .47, -.03), (.68, .64, .56, .00),
    (1.00, .75, .65, .00), (1.30, .78, .67, .00),
    (1.60, .76, .68, -.02), (1.90, .70, .67, -.06),
    (2.10, .54, .50, -.09), (2.25, .29, .27, -.10),
    (2.30, .00, .00, -.10),
]
EYES = [dict(name='eye_negative_x', lo=51, hi=59, bottom=52, top=58,
             cx=-.335, cy=HEIGHT*55/J, cz=.52, rx=.145, ry=.075, radius=.17),
        dict(name='eye_positive_x', lo=69, hi=77, bottom=52, top=58,
             cx=.335, cy=HEIGHT*55/J, cz=.52, rx=.145, ry=.075, radius=.17)]
HEAD_COLOUR = (.55, .36, .26)
LIP_COLOUR = (.40, .225, .195)
SEAM_COLOUR = (.21, .115, .10)


def add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x*s for x in a)


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def norm(a):
    d = math.sqrt(dot(a, a))
    assert d > 1e-14 and math.isfinite(d), ('zero/nonfinite normal', a)
    return mul(a, 1/d)


def gaussian(x, scale):
    return math.exp(-(x/scale)**2)


def section(y):
    for low, high in zip(SECTIONS, SECTIONS[1:]):
        if low[0] <= y <= high[0]:
            t = (y-low[0])/(high[0]-low[0])
            # Smooth section interpolation is shape authorship, not a fit solve.
            t = t*t*(3-2*t)
            return tuple(a+(b-a)*t for a, b in zip(low[1:], high[1:]))
    raise ValueError(('undeclared section', y))


def mouth_y(x):
    return .855 + .025*(x/.26)**2


def facial_relief(x, y):
    bridge = .16*gaussian(x, .075)*gaussian(y-1.32, .225)
    tip = .235*gaussian(x, .115)*gaussian(y-1.14, .078)
    alar = sum(.10*gaussian(x-side*.105, .050)*gaussian(y-1.09, .045)
               for side in (-1, 1))
    nostril_dents = sum(-.040*gaussian(x-side*.092, .027)*
                        gaussian(y-1.075, .018) for side in (-1, 1))
    muzzle = .045*gaussian(x, .28)*gaussian(y-.91, .18)
    lip_width = math.exp(-(x/.255)**6)
    seam = mouth_y(x)
    # Continuous relief on the connected head, never floating lip primitives.
    upper = .052*lip_width*gaussian(y-(seam+.031), .024)
    lower = .068*lip_width*gaussian(y-(seam-.031), .029)
    groove = -.017*lip_width*gaussian(y-seam, .009)
    cheeks = sum(.065*gaussian(x-side*.38, .18)*gaussian(y-1.13, .17)
                 for side in (-1, 1))
    brows = sum(.038*gaussian(x-side*.33, .20)*gaussian(y-1.61, .075)
                for side in (-1, 1))
    chin = .070*gaussian(x, .225)*gaussian(y-.565, .10)
    return sum((bridge, tip, alar, nostril_dents, muzzle, upper, lower,
                groove, cheeks, brows, chin))


def head_point(i, j):
    y = HEIGHT*j/J
    theta = 2*math.pi*(i-N/2)/N
    w, d, cz = section(y)
    x = w*math.sin(theta)
    eye_weight = 0.0
    chosen = None
    if math.cos(theta) > 0:
        for eye in EYES:
            u = (i-(eye['lo']+eye['hi'])/2)/((eye['hi']-eye['lo'])/2)
            v = (j-(eye['bottom']+eye['top'])/2)/((eye['top']-eye['bottom'])/2)
            k = max(abs(u), abs(v))
            if k < 2.25:
                weight = max(0.0, min(1.0, (2.25-k)/1.25))**2
                # A rectangle's boundary maps to an ellipse, with corners at
                # 45 degrees. The exterior blends back to the authored head.
                target_x = eye['cx']+eye['rx']*u*math.sqrt(
                    max(.5, 1-.5*(v/max(1, k))**2))
                target_y = eye['cy']+eye['ry']*v*math.sqrt(
                    max(.5, 1-.5*(u/max(1, k))**2))
                x += weight*(target_x-x)
                y += weight*(target_y-y)
                chosen, eye_weight = eye, max(0.0, min(1.0, (1.85-k)/.85))
                break
    w, d, cz = section(y)
    # The angular half-space stays explicit, including at side/back points.
    z = cz + math.copysign(d*math.sqrt(max(0, 1-(x/w)**2)), math.cos(theta))
    if math.cos(theta) > 0:
        z += max(0, math.cos(theta))**4*facial_relief(x, y)
    if chosen is not None and eye_weight > 0:
        inside = chosen['radius']**2-(x-chosen['cx'])**2-(y-chosen['cy'])**2
        lid_z = chosen['cz']+math.sqrt(max(0.0, inside))+.008
        z += eye_weight*(lid_z-z)
    return (x, y, z)


def original_head():
    vertices = [head_point(i, j) for j in range(J) for i in range(N)]
    faces = []
    address = lambda i, j: j*N+i % N
    for j in range(J-1):
        for i in range(N):
            if any(e['lo'] <= i < e['hi'] and e['bottom'] <= j < e['top']
                   for e in EYES):
                continue
            a, b, c, d = (address(i, j), address(i+1, j),
                           address(i+1, j+1), address(i, j+1))
            faces.extend(((a, b, c), (a, c, d)))
    tip = len(vertices)
    vertices.append((0.0, HEIGHT, -.10))
    faces.extend((address(i, J-1), address(i+1, J-1), tip) for i in range(N))
    used = sorted(set(v for f in faces for v in f))
    remap = {old: new for new, old in enumerate(used)}
    vertices = [vertices[v] for v in used]
    faces = [tuple(remap[v] for v in f) for f in faces]
    loops = {'neck': [remap[address(i, 0)] for i in range(N)]}
    for e in EYES:
        l, r, b, t = e['lo'], e['hi'], e['bottom'], e['top']
        ordered = ([(i, b) for i in range(l, r)] +
                   [(r, j) for j in range(b, t)] +
                   [(i, t) for i in range(r, l, -1)] +
                   [(l, j) for j in range(t, b, -1)])
        loops[e['name']+'_lid'] = [remap[address(i, j)] for i, j in ordered]
    targets = {'nose_bridge': (64, 54), 'nose_tip': (64, 44),
               'alar_negative_x': (62, 42), 'alar_positive_x': (66, 42),
               'philtrum': (64, 37), 'upper_lip': (64, 35),
               'closed_mouth_seam': (64, 33), 'lower_lip': (64, 32),
               'chin': (64, 22), 'jaw_negative_x': (44, 25),
               'jaw_positive_x': (84, 25)}
    landmarks = {name: dict(vertex=remap[address(*ij)], grid=list(ij),
                            position=vertices[remap[address(*ij)]])
                 for name, ij in targets.items()}
    regions = {name: [] for name in ('neck', 'cranium', 'nose', 'lips',
                                     'cheeks', 'brows', 'eyelid_rims')}
    lid_ids = set(v for name, loop in loops.items() if name != 'neck' for v in loop)
    for idx, (x, y, z) in enumerate(vertices):
        if y < .40:
            regions['neck'].append(idx)
        if y > 1.72 or z < -.12:
            regions['cranium'].append(idx)
        if abs(x) < .18 and 1.025 < y < 1.59 and z > .50:
            regions['nose'].append(idx)
        if abs(x) < .28 and abs(y-mouth_y(x)) < .075 and z > .50:
            regions['lips'].append(idx)
        if .22 < abs(x) < .58 and .93 < y < 1.30 and z > .35:
            regions['cheeks'].append(idx)
        if .12 < abs(x) < .57 and 1.52 < y < 1.70 and z > .35:
            regions['brows'].append(idx)
        if idx in lid_ids:
            regions['eyelid_rims'].append(idx)
    colours = []
    for f in faces:
        x, y, z = tuple(sum(vertices[v][k] for v in f)/3 for k in range(3))
        distance = abs(y-mouth_y(x))
        colours.append(SEAM_COLOUR if abs(x) < .25 and distance < .010 and z > .5
                       else LIP_COLOUR if abs(x) < .255 and distance < .056 and z > .5
                       else HEAD_COLOUR)
    return dict(name='head_face_cranium_jaw_neck', vertices=vertices,
                faces=faces, colours=colours, boundaries=loops,
                landmarks=landmarks, regions=regions, expectedBoundaries=3,
                expectedEuler=-1)


def sphere(eye):
    longitude, latitude = 40, 20
    vertices = [(eye['cx'], eye['cy']+eye['radius'], eye['cz'])]
    for j in range(1, latitude):
        p = math.pi*j/latitude
        for i in range(longitude):
            t = 2*math.pi*i/longitude
            vertices.append((eye['cx']+eye['radius']*math.sin(p)*math.sin(t),
                             eye['cy']+eye['radius']*math.cos(p),
                             eye['cz']+eye['radius']*math.sin(p)*math.cos(t)))
    south = len(vertices)
    vertices.append((eye['cx'], eye['cy']-eye['radius'], eye['cz']))
    ring = lambda i, j: 1+(j-1)*longitude+i % longitude
    faces = [(0, ring(i+1, 1), ring(i, 1)) for i in range(longitude)]
    for j in range(1, latitude-1):
        for i in range(longitude):
            a, b, c, d = ring(i, j), ring(i+1, j), ring(i+1, j+1), ring(i, j+1)
            faces.extend(((a, b, c), (a, c, d)))
    faces.extend((ring(i, latitude-1), ring(i+1, latitude-1), south)
                 for i in range(longitude))
    # Sphere parameterization runs from north to south: enforce outward winding
    # from its literal centre rather than silently trusting a rendering normal.
    outward = []
    centre = (eye['cx'], eye['cy'], eye['cz'])
    for a, b, c in faces:
        normal = cross(sub(vertices[b], vertices[a]), sub(vertices[c], vertices[a]))
        centre_delta = sub(vertices[a], centre)
        outward.append((a, b, c) if dot(normal, centre_delta) > 0 else (a, c, b))
    colours = []
    for f in outward:
        average_z = sum(vertices[v][2]-eye['cz'] for v in f)/3/eye['radius']
        colours.append((.018, .012, .009) if average_z > .987 else
                       (.105, .065, .035) if average_z > .925 else (.87, .85, .80))
    return dict(name=eye['name'], vertices=vertices, faces=outward,
                colours=colours, expectedBoundaries=0, expectedEuler=2,
                attachment=dict(centre=centre, radius=eye['radius'],
                                role='Separate authored sphere behind named eyelid rim; '
                                'no welded eye/head, anatomical or collision qualification.'))


def ear(side):
    count, rings = 48, 8
    vertices, faces = [], []
    # Front and back disks have distinct central vertices and share no rim;
    # a declared outer strip closes them into a separate genus-zero part.
    for surface in (0, 1):
        for j in range(rings+1):
            r = j/rings
            indices = [0] if j == 0 else range(count)
            for i in indices:
                a = 2*math.pi*i/count
                x = (.75+.045+.060*gaussian(r-.76, .12)-.025*gaussian(r, .38)
                     if surface == 0 else .75-.010+.018*(1-r*r))
                vertices.append((side*x, 1.23+.21*r*math.cos(a),
                                 -.015+.125*r*math.sin(a)))
    disk_size = 1+rings*count
    idx = lambda surf, j, i: surf*disk_size+(0 if j == 0 else 1+(j-1)*count+i % count)
    for surf in (0, 1):
        for i in range(count):
            faces.append((idx(surf, 0, 0), idx(surf, 1, i), idx(surf, 1, i+1)))
        for j in range(1, rings):
            for i in range(count):
                a, b, c, d = (idx(surf, j, i), idx(surf, j+1, i),
                               idx(surf, j+1, i+1), idx(surf, j, i+1))
                faces.extend(((a, b, c), (a, c, d)))
    for i in range(count):
        a, b, c, d = idx(0, rings, i), idx(1, rings, i), idx(1, rings, i+1), idx(0, rings, i+1)
        faces.extend(((a, b, c), (a, c, d)))
    # Establish consistent directed adjacency from the first outer disk face.
    edges = {}
    for fi, f in enumerate(faces):
        for a, b in zip(f, f[1:]+f[:1]):
            edges.setdefault(tuple(sorted((a, b))), []).append((fi, a < b))
    flips, stack = {0: False}, [0]
    while stack:
        fi = stack.pop()
        f = faces[fi]
        for a, b in zip(f, f[1:]+f[:1]):
            for other, direction in edges[tuple(sorted((a, b)))]:
                if other != fi:
                    needed = flips[fi] ^ ((a < b) == direction)
                    if other in flips:
                        assert flips[other] == needed, 'Nonorientable ear'
                    else:
                        flips[other] = needed
                        stack.append(other)
    faces = [f if not flips[i] else (f[0], f[2], f[1]) for i, f in enumerate(faces)]
    volume = sum(dot(vertices[a], cross(vertices[b], vertices[c]))/6 for a, b, c in faces)
    if volume < 0:
        faces = [(a, c, b) for a, b, c in faces]
    return dict(name='ear_positive_x' if side > 0 else 'ear_negative_x',
                vertices=vertices, faces=faces, colours=[HEAD_COLOUR]*len(faces),
                expectedBoundaries=0, expectedEuler=2,
                attachment=dict(frameOrigin=(side*.75, 1.23, -.015),
                                role='Separate closed artist pinna, undeformed and unwelded; '
                                'root intersection/attachment not anatomically qualified.'))


def check_part(part):
    vertices, faces = part['vertices'], part['faces']
    assert vertices and faces
    assert all(len(v) == 3 and all(math.isfinite(x) for x in v) for v in vertices)
    assert len(part['colours']) == len(faces)
    edges, graph = {}, [set() for _ in vertices]
    for f in faces:
        assert len(f) == 3 and len(set(f)) == 3 and all(0 <= v < len(vertices) for v in f)
        a, b, c = (vertices[v] for v in f)
        n = cross(sub(b, a), sub(c, a))
        assert dot(n, n) > 1e-16, ('degenerate face', part['name'], f)
        for u, v in zip(f, f[1:]+f[:1]):
            edges.setdefault(tuple(sorted((u, v))), []).append((u, v))
            graph[u].add(v)
            graph[v].add(u)
    assert all(1 <= len(rows) <= 2 for rows in edges.values())
    assert all(len(rows) == 1 or rows[0] == rows[1][::-1] for rows in edges.values())
    seen, stack = {0}, [0]
    while stack:
        for v in graph[stack.pop()]:
            if v not in seen:
                seen.add(v)
                stack.append(v)
    assert len(seen) == len(vertices), ('Disconnected/unused vertex', part['name'])
    boundary_edges = {edge for edge, rows in edges.items() if len(rows) == 1}
    bg = {}
    for a, b in boundary_edges:
        bg.setdefault(a, set()).add(b)
        bg.setdefault(b, set()).add(a)
    assert all(len(neighbours) == 2 for neighbours in bg.values())
    boundary_components, walked = 0, set()
    for v in bg:
        if v in walked:
            continue
        boundary_components += 1
        todo, walked = [v], walked | {v}
        while todo:
            for w in bg[todo.pop()]:
                if w not in walked:
                    walked.add(w)
                    todo.append(w)
    euler = len(vertices)-len(edges)+len(faces)
    assert boundary_components == part['expectedBoundaries'], (part['name'], boundary_components)
    assert euler == part['expectedEuler'], (part['name'], euler)
    if part.get('boundaries'):
        named_edges = set()
        for name, loop in part['boundaries'].items():
            assert len(loop) == len(set(loop))
            for a, b in zip(loop, loop[1:]+loop[:1]):
                edge = tuple(sorted((a, b)))
                assert edge in boundary_edges and edge not in named_edges, (name, edge)
                named_edges.add(edge)
        assert named_edges == boundary_edges, 'Unowned opening edge'
        assert all(part['regions'].values()), 'Empty declared feature region'
        for landmark in part['landmarks'].values():
            assert list(vertices[landmark['vertex']]) == list(landmark['position'])
    return dict(name=part['name'], vertices=len(vertices), triangles=len(faces),
                connected=True, directedManifoldEdges=True, euler=euler,
                boundaryComponents=boundary_components, boundaryEdges=len(boundary_edges),
                finite=True, nondegenerate=True)


def vertex_normals(part):
    accum = [[0.0, 0.0, 0.0] for _ in part['vertices']]
    for a, b, c in part['faces']:
        n = cross(sub(part['vertices'][b], part['vertices'][a]),
                  sub(part['vertices'][c], part['vertices'][a]))
        for vertex in (a, b, c):
            for axis in range(3):
                accum[vertex][axis] += n[axis]
    return [norm(n) for n in accum]


FONT = {
    'F':['11111','10000','11110','10000','10000','10000','10000'],
    'R':['11110','10001','10001','11110','10100','10010','10001'],
    'O':['01110','10001','10001','10001','10001','10001','01110'],
    'N':['10001','11001','11001','10101','10011','10011','10001'],
    'T':['11111','00100','00100','00100','00100','00100','00100'],
    'P':['11110','10001','10001','11110','10000','10000','10000'],
    'I':['11111','00100','00100','00100','00100','00100','11111'],
    'L':['10000','10000','10000','10000','10000','10000','11111'],
    'E':['11111','10000','10000','11110','10000','10000','11111'],
    'B':['11110','10001','10001','11110','10001','10001','11110'],
    'Q':['01110','10001','10001','10001','10101','10010','01101'],
    'U':['10001','10001','10001','10001','10001','10001','01110'],
    'A':['01110','10001','10001','11111','10001','10001','10001'],
}


def draw_label(pixels, text, x, y):
    for index, letter in enumerate(text):
        for row, bits in enumerate(FONT[letter]):
            for col, bit in enumerate(bits):
                if bit == '1':
                    for dy in range(3):
                        for dx in range(3):
                            px, py = x+index*21+col*3+dx, y+row*3+dy
                            at = 3*(py*WIDTH+px)
                            pixels[at:at+3] = b'\x42\x3e\x3a'


def render(parts):
    pixels = bytearray(bytes((229, 226, 220))*(WIDTH*IMAGE_HEIGHT))
    zbuffer = array.array('f', [-float('inf')])*(WIDTH*IMAGE_HEIGHT)
    light = norm((-.48, .75, .65))
    fill = norm((.75, .25, .35))
    normals = [vertex_normals(part) for part in parts]
    views = [('FRONT', 0.0), ('PROFILE', math.pi/2),
             ('OBLIQUE', math.radians(35)), ('REAR', math.pi)]
    stats = []
    for view_number, (label, yaw) in enumerate(views):
        ox, oy = (view_number % 2)*720, (view_number//2)*720
        right, toward_camera = (math.cos(yaw), 0, -math.sin(yaw)), (math.sin(yaw), 0, math.cos(yaw))
        scale = 252.0
        shaded_pixels = 0
        for part, smooth in zip(parts, normals):
            projected = [(ox+360+scale*dot(v, right), oy+630-scale*v[1],
                          dot(v, toward_camera)) for v in part['vertices']]
            assert all(all(math.isfinite(c) for c in v) for v in projected)
            for fi, face in enumerate(part['faces']):
                va, vb, vc = [part['vertices'][v] for v in face]
                if dot(cross(sub(vb, va), sub(vc, va)), toward_camera) <= 0:
                    continue
                a, b, c = [projected[v] for v in face]
                area = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
                if abs(area) < 1e-9:
                    continue
                xmin = max(ox+18, math.floor(min(a[0], b[0], c[0])))
                xmax = min(ox+702, math.ceil(max(a[0], b[0], c[0])))
                ymin = max(oy+18, math.floor(min(a[1], b[1], c[1])))
                ymax = min(oy+650, math.ceil(max(a[1], b[1], c[1])))
                colour = part['colours'][fi]
                na, nb, nc = [smooth[v] for v in face]
                for py in range(ymin, ymax+1):
                    for px in range(xmin, xmax+1):
                        x, y = px+.5, py+.5
                        wb = ((x-a[0])*(c[1]-a[1])-(y-a[1])*(c[0]-a[0]))/area
                        wc = ((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/area
                        wa = 1-wb-wc
                        if min(wa, wb, wc) < -1e-9:
                            continue
                        depth = wa*a[2]+wb*b[2]+wc*c[2]
                        at = py*WIDTH+px
                        if depth <= zbuffer[at]:
                            continue
                        normal = norm(tuple(wa*na[k]+wb*nb[k]+wc*nc[k] for k in range(3)))
                        diffuse = .34+.51*max(0, dot(normal, light))+.15*max(0, dot(normal, fill))
                        rgb = [round(255*max(0, min(1, diffuse*channel))**(1/2.2))
                               for channel in colour]
                        zbuffer[at] = depth
                        pixels[at*3:at*3+3] = bytes(rgb)
                        shaded_pixels += 1
        assert shaded_pixels > 20000, ('Empty/unreadable projection', label)
        draw_label(pixels, label, ox+30, oy+679)
        stats.append(dict(name=label, yawRadians=yaw, scale=scale,
                          shadeWrites=shaded_pixels,
                          framing='720-square panel; head height579.6px, fixed top50.4/bottom630'))
    def chunk(name, body):
        return struct.pack('>I', len(body))+name+body+struct.pack('>I', zlib.crc32(name+body)&0xffffffff)
    scanlines = bytearray()
    for y in range(IMAGE_HEIGHT):
        scanlines.append(0)
        scanlines.extend(pixels[y*WIDTH*3:(y+1)*WIDTH*3])
    png = (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, IMAGE_HEIGHT, 8, 2, 0, 0, 0))+
           chunk(b'IDAT', zlib.compress(bytes(scanlines), 6))+chunk(b'IEND', b''))
    return png, stats


def write_json(name, value):
    (OUT/name).write_text(json.dumps(value, separators=(',', ':'), allow_nan=False)+'\n')


def main():
    assert not OUT.exists(), 'One-shot output must not already exist'
    OUT.mkdir()
    parts = [original_head()] + [sphere(e) for e in EYES] + [ear(-1), ear(1)]
    assert len(parts) == 5
    checks = [check_part(part) for part in parts]
    assert sum(len(p['vertices']) for p in parts) < 16000
    assert sum(len(p['faces']) for p in parts) < 32000
    png, views = render(parts)
    mesh = dict(frame='unitless right-handed +X right/+Y up/+Z anterior; neck y0/top2.30',
                authorship='Entire original artist source. Hidden choices invented; no reconstruction/registration.',
                sections=SECTIONS, eyeControls=EYES, parts=parts,
                exclusions=['No anatomical identity/eye-ear weld or all-facet self/interpart contact pass.',
                            'No physical dimensions/UV/texture/rig/morph/pose/expression/hair/body-fit/runtime/AAA qualification.'])
    write_json('head.mesh.json', mesh)
    landmarks = dict(frame=mesh['frame'], features=parts[0]['landmarks'],
                     boundaries=parts[0]['boundaries'], regions=parts[0]['regions'],
                     eyes=EYES, ears=[p['attachment'] for p in parts[3:]],
                     allIDsLocalToHeadPart=True)
    write_json('head.landmarks.json', landmarks)
    with (OUT/'head.obj').open('w') as f:
        f.write('# Original unitless head artist study; no registered Ari anatomy.\n')
        offset = 1
        for part in parts:
            f.write('o '+part['name']+'\n')
            for v in part['vertices']:
                f.write('v '+' '.join(format(x, '.17g') for x in v)+'\n')
            for face in part['faces']:
                f.write('f '+' '.join(str(v+offset) for v in face)+'\n')
            offset += len(part['vertices'])
    (OUT/'first-head.png').write_bytes(png)
    write_json('CHECKS.json', dict(parts=checks, views=views,
                                 vertices=sum(x['vertices'] for x in checks),
                                 triangles=sum(x['triangles'] for x in checks),
                                 requiredParts=5, image=[WIDTH, IMAGE_HEIGHT],
                                 topologySupportsButDoesNotQualifyAppearance=True,
                                 allFacetOrInterpartContactTested=False))
    outputs = []
    for p in sorted(OUT.iterdir()):
        data = p.read_bytes()
        outputs.append(dict(path=p.name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
    write_json('OUTPUTS.json', outputs)
    print(json.dumps(dict(status='SOURCE_BUILT_NUMERICALLY_NOT_VISUALLY_QUALIFIED',
                          vertices=sum(x['vertices'] for x in checks),
                          triangles=sum(x['triangles'] for x in checks), outputs=outputs)))


if __name__ == '__main__':
    main()
