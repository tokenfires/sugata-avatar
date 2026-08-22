"""How dense does the bob have to be before its SILHOUETTE stops changing?

The mask is exact, not thresholded off a beauty render: each plate is rendered twice, once
in the control's brown and once with the hair albedo forced to pure green. Skin and
background in this scene are achromatic, so `G > R + 12` is hair and nothing else.

Three numbers per density, per view:

  coverage      hair pixels. Rises until the groom stops adding new silhouette.
  solidity      coverage inside the densest groom's FILLED silhouette, as a fraction of that
                silhouette's area. This is the "can you see through it" number -- a sparse
                groom occupies the right outline but reads as separate strings.
  outline IoU   intersection-over-union of the FILLED silhouette against the densest groom's.
                Once this saturates, adding strands no longer changes the shape you see.

FILLED silhouette = binary close with a square of side 2r+1, then flood-fill holes from the
frame border. r is in pixels at the plate's own resolution, and is the scale at which a gap
stops reading as a gap.
"""
import numpy as np, sys, json
from pngread import readpng

R = 6  # closing radius, px, at 720x900

def dil(m, r):
    out = m.copy()
    for ax in (0, 1):
        acc = out.copy()
        for k in range(1, r + 1):
            acc |= np.roll(out, k, axis=ax) | np.roll(out, -k, axis=ax)
        out = acc
    return out

def ero(m, r):
    return ~dil(~m, r)

def fill_holes(m):
    # everything reachable from the border through the complement is outside
    free = ~m
    out = np.zeros_like(m)
    out[0, :] |= free[0, :]; out[-1, :] |= free[-1, :]
    out[:, 0] |= free[:, 0]; out[:, -1] |= free[:, -1]
    while True:
        grow = (dil(out, 1) & free)
        if grow.sum() == out.sum():
            break
        out = grow
    return ~out

def mask_of(path):
    a = readpng(path).astype(np.int32)
    return a[:, :, 1] > a[:, :, 0] + 12

def beauty(path):
    return readpng(path).astype(np.float64)[:, :, :3]

DENS = ['00016', '00496', '00992', '02480', '04960', '11408', '24800']
VIEWS = ['az00', 'az40', 'az90']
D = sys.argv[1] if len(sys.argv) > 1 else 'plates'

report = {}
for v in VIEWS:
    masks = {n: mask_of(f'{D}/key-{n}-{v}.png') for n in DENS}
    filled = {n: fill_holes(dil(ero(dil(masks[n], R), R), 0)) for n in DENS}
    ref = filled['24800']
    refA = int(ref.sum())
    bref = beauty(f'{D}/beauty-24800-{v}.png')
    print(f'--- view {v}   reference = 24800 strands, filled silhouette {refA} px')
    print(f"{'strands':>8}{'coverage':>10}{'cov/ref':>9}{'solidity':>10}{'outlineIoU':>12}{'beautyMAE':>11}")
    rows = []
    for n in DENS:
        m = masks[n]; f = filled[n]
        cov = int(m.sum())
        inter = int((f & ref).sum()); union = int((f | ref).sum())
        iou = inter / union if union else float('nan')
        solid = int((m & ref).sum()) / refA
        b = beauty(f'{D}/beauty-{n}-{v}.png')
        mae = float(np.abs(b - bref)[ref].mean())
        covref = cov / int(masks['24800'].sum())
        print(f'{int(n):>8}{cov:>10}{covref:>9.3f}{solid:>10.3f}{iou:>12.4f}{mae:>11.2f}')
        rows.append(dict(strands=int(n), coverage=cov, covOverRef=covref, solidity=solid,
                         outlineIoU=iou, beautyMAE=mae, filledPx=int(f.sum())))
    report[v] = dict(refFilledPx=refA, rows=rows)
    print()
json.dump(report, open('silhouette.json', 'w'), indent=2)
print('wrote silhouette.json')
