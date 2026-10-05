"""Original open overshirt blockout. Unitless artist choices; no body-derived data."""
from pathlib import Path
import collections
import json
import math

BASE = Path(__file__).resolve().parent
OUT = BASE / 'export'
positions, labels, faces, roles = [], [], [], []
ids = {}


def vertex(label, xyz):
    assert label not in ids, label
    ids[label] = len(positions)
    labels.append(label)
    positions.append([round(float(v), 8) for v in xyz])
    return ids[label]


def quad(role, *corners):
    assert len(corners) == 4 and len(set(corners)) == 4
    faces.append(list(corners))
    roles.append(role)


# Every number below is original authorship, not a measurement of the reference.
ys = [.15, .22, .70, .95, 1.20]
front_x = [.54, .42, .30, .22, .14]
top_x = [.54, .42, .30, .22, .18]
front_z = [.24, .25, .26, .24, .18]
back_x = [-.54, -.42, -.30, -.22, -.18, 0, .18, .22, .30, .42, .54]
back_z = [-.24, -.25, -.24, -.23, -.18]
fronts = {}
for name, side in [('left', -1), ('right', 1)]:
    grid = []
    for r, y in enumerate(ys):
        row = []
        for c in range(5):
            x = (top_x if r == 4 else front_x)[c]
            vy = 1.17 if r == 4 and c == 4 else y
            row.append(vertex(f'{name}.front.{r}.{c}', [side*x, vy, front_z[r]]))
        grid.append(row)
    for r in range(4):
        for c in range(4):
            role = 'front_facing' if c == 3 else ('hem_band' if r == 0 else 'front_panel')
            quad(role, grid[r][c], grid[r][c+1], grid[r+1][c+1], grid[r+1][c])
    fronts[name] = grid

back = []
for r, y in enumerate(ys):
    row = []
    for c, x in enumerate(back_x):
        vy = y
        if r == 4 and abs(x) <= .18:
            vy = 1.30 if x == 0 else 1.28
        row.append(vertex(f'back.{r}.{c}', [x, vy, back_z[r]]))
    back.append(row)
for r in range(4):
    for c in range(10):
        role = 'back_yoke' if r == 3 else ('hem_band' if r == 0 else 'back_panel')
        quad(role, back[r][c], back[r+1][c], back[r+1][c+1], back[r][c+1])

neck_mid, sleeve_roots, cuffs = {}, {}, {}
for name, side, bc in [('left', -1, 0), ('right', 1, 10)]:
    front = fronts[name]
    side_mid = [vertex(f'{name}.side.{r}', [side*.57, ys[r], 0]) for r in range(3)]
    for r in range(2):
        quad('side_panel', front[r][0], side_mid[r], side_mid[r+1], front[r+1][0])
        quad('side_panel', side_mid[r], back[r][bc], back[r+1][bc], side_mid[r+1])
    shoulder_mid = []
    for c, x in enumerate(top_x):
        shoulder_mid.append(vertex(f'{name}.shoulder.{c}', [side*x, 1.31 if c == 4 else 1.23, 0]))
    for c in range(4):
        b0, b1 = bc-side*c, bc-side*(c+1)
        quad('shoulder', front[4][c], front[4][c+1], shoulder_mid[c+1], shoulder_mid[c])
        quad('shoulder', shoulder_mid[c], shoulder_mid[c+1], back[4][b1], back[4][b0])
    neck_mid[name] = shoulder_mid[4]
    root = [front[2][0], front[3][0], front[4][0], shoulder_mid[0],
            back[4][bc], back[3][bc], back[2][bc], side_mid[2]]
    sleeve_roots[name] = root
    previous = root
    # Center X/Y, XY plane tilt, radius in XY, depth radius. Full hanging wrists.
    rings = [(.72, .83, .72, .22, .20), (.83, .59, 1.20, .19, .18),
             (.86, .38, 1.33, .175, .17), (.90, .22, 1.42, .155, .155),
             (.90, .15, 1.42, .155, .155)]
    angles = [135, 90, 45, 0, -45, -90, -135, 180]
    for r, (cx, cy, tilt, radius, depth) in enumerate(rings):
        current = []
        for c, degrees in enumerate(angles):
            angle = math.radians(degrees)
            radial = math.cos(angle)*radius
            current.append(vertex(f'{name}.sleeve.{r}.{c}',
                [side*(cx+math.sin(tilt)*radial), cy+math.cos(tilt)*radial, math.sin(angle)*depth]))
        for c in range(8):
            n = (c+1) % 8
            quad('cuff_band' if r == 4 else 'sleeve', previous[c], previous[n], current[n], current[c])
        previous = current
    cuffs[name] = previous

# The stand/leaf attach along the actual body neck boundary, not floating overlays.
neck = [fronts['left'][4][4], neck_mid['left'], back[4][4], back[4][5],
        back[4][6], neck_mid['right'], fronts['right'][4][4]]
stand, leaf = [], []
widths = [.16, .10, .09, .09, .09, .10, .16]
drops = [.13, .05, .02, .02, .02, .05, .13]
for c, v in enumerate(neck):
    x, y, z = positions[v]
    stand.append(vertex(f'collar.stand.{c}', [x, y+.05, z]))
    radius = math.hypot(x, z)
    assert radius > 0
    leaf.append(vertex(f'collar.leaf.{c}', [x+x/radius*widths[c], y+.05-drops[c], z+z/radius*widths[c]]))
for c in range(6):
    quad('collar_stand', neck[c], neck[c+1], stand[c+1], stand[c])
    quad('collar_leaf', stand[c], stand[c+1], leaf[c+1], leaf[c])

# Original constructor normalises shared-edge winding once before the first export.
incidence = collections.defaultdict(list)
for fi, q in enumerate(faces):
    for a, b in zip(q, q[1:]+q[:1]):
        incidence[tuple(sorted((a, b)))].append((fi, a, b))
assert all(len(v) in (1, 2) for v in incidence.values())
adj = collections.defaultdict(list)
for entries in incidence.values():
    if len(entries) == 2:
        (a, av, bv), (b, cv, dv) = entries
        same = av == cv and bv == dv
        adj[a].append((b, same)); adj[b].append((a, same))
flip, queue = {0: False}, collections.deque([0])
while queue:
    a = queue.popleft()
    for b, same in adj[a]:
        need = flip[a] ^ same
        if b in flip:
            assert flip[b] == need, 'Nonorientable original graph'
        else:
            flip[b] = need; queue.append(b)
assert len(flip) == len(faces), 'Disconnected original graph'
faces = [q[::-1] if flip[i] else q for i, q in enumerate(faces)]

# Derive exact free loops from the completed source graph, then assign responsibilities.
boundary_adj = collections.defaultdict(list)
for (a, b), entries in incidence.items():
    if len(entries) == 1:
        boundary_adj[a].append(b); boundary_adj[b].append(a)
assert all(len(ns) == 2 for ns in boundary_adj.values())
unseen, loops = set(boundary_adj), []
while unseen:
    start = min(unseen); previous = None; current = start; loop = []
    while True:
        loop.append(current); unseen.remove(current)
        candidates = [n for n in boundary_adj[current] if n != previous]
        nxt = min(candidates) if previous is None else candidates[0]
        previous, current = current, nxt
        if current == start:
            break
    loops.append(loop)
boundaries = {}
for loop in loops:
    if set(loop) == set(cuffs['left']): name = 'left_wrist'
    elif set(loop) == set(cuffs['right']): name = 'right_wrist'
    else: name = 'continuous_collar_front_hem'
    assert name not in boundaries
    boundaries[name] = loop
assert set(boundaries) == {'left_wrist', 'right_wrist', 'continuous_collar_front_hem'}
assert len(positions)-len(incidence)+len(faces) == -1

mesh = {'title': 'Original open overshirt blockout', 'units': 'unitless',
        'axes': {'X':'lateral', 'Y':'upright', 'Z':'front'},
        'positions': positions, 'vertex_labels': labels, 'quads': faces, 'face_roles': roles,
        'seams': {'neck': neck, 'left_armhole': sleeve_roots['left'], 'right_armhole': sleeve_roots['right']},
        'boundaries': boundaries,
        'limits': ['Original artist choices; hidden rear/depth and hanging sleeve pose are not image measurements',
                   'Coarse source blockout; no body, fabric thickness, fit, cloth, motion, material finish or AAA qualification']}
obj = ['# Original Cora-authored open overshirt; unitless blockout']
obj += ['v '+' '.join(f'{c:.8f}' for c in v) for v in positions]
last = None
for role, face in zip(roles, faces):
    if role != last: obj.append('g '+role); last = role
    obj.append('f '+' '.join(str(v+1) for v in face))
# The whole deterministic graph is prepared before writing to a new owned leaf.
assert not OUT.exists(), 'Refuse overwrite / second export'
OUT.mkdir()
(OUT/'mesh.json').write_text(json.dumps(mesh, indent=2)+'\n')
(OUT/'overshirt.obj').write_text('\n'.join(obj)+'\n')
print(json.dumps({'vertices':len(positions), 'quads':len(faces), 'boundaries':{n:len(v) for n,v in boundaries.items()},
                  'roles':dict(collections.Counter(roles)), 'scope':'Original source blockout only'}))
