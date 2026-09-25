"""Isolated crop ribbon diagnostic. Defaults to a byte-equivalent geometry rebuild."""
import json, math, os, runpy, sys
from pathlib import Path
from collections import defaultdict
from mathutils import Vector

pipeline = Path.cwd() / 'tools' / 'figure-pipeline'
sys.path.insert(0, str(pipeline))
import hair_cards as h

output = Path(os.environ['RIBBON_REPORT'])
mode = os.environ.get('RIBBON_MODE', 'baseline')
assert mode in ('baseline','closest','slender','closest-slender'), mode
rows = []
context = {}
original_layer = h.grow_layer
original_draw = h.draw_into_lock
original_ribbon = h.ribbon_of
original_assemble = h.assemble_cards
original_clamp = h.clamp_cards_off_the_body

def arc(points):
    return sum((b-a).length for a,b in zip(points, points[1:]))

def angle(a,b):
    if min(a.length,b.length) < 1e-9:
        return 0.0
    return math.degrees(math.acos(max(-1.0,min(1.0,a.normalized().dot(b.normalized())))))

def tangents(points):
    return [points[min(i+1,len(points)-1)]-points[max(i-1,0)] for i in range(len(points))]

def curve(points):
    spans = [b-a for a,b in zip(points,points[1:])]
    return dict(arcMm=arc(points)*1000,
                maxTurnDeg=max(angle(a,b) for a,b in zip(spans,spans[1:])))

def ribbon_stats(rings):
    centres = [(a+b)*0.5 for a,b,_ in rings]
    across = [b-a for a,b,_ in rings]
    return dict(**curve(centres), rootWidthMm=across[0].length*1000,
                tipWidthMm=across[-1].length*1000,
                aspect=arc(centres)/across[0].length,
                maxAcrossTurnDeg=max(angle(a,b) for a,b in zip(across,across[1:])))

def grow_layer(basemesh,frame,body,layer,locks,edge_scale,arguments):
    context['layer'] = layer['name']
    return original_layer(basemesh,frame,body,layer,locks,edge_scale,arguments)

def draw(guide,lock_guide,tightness,body,standoff):
    blended = original_draw(guide,lock_guide,tightness,None,standoff)
    result = original_draw(guide,lock_guide,tightness,body,standoff)
    if mode in ('closest','closest-slender') and body is not None and tightness > 0:
        result = [p.copy() for p in blended]
        for _ in range(h.CLUMP_CLEARANCE_PASSES):
            moved = False
            for i,point in enumerate(result):
                location,normal,distance = h.signed_distance_to(body,point)
                if location is not None and distance < standoff:
                    # Outside the mesh, the closest-point displacement is the Euclidean
                    # distance gradient. A smoothed shading normal can drift along an edge.
                    direction = (point-location).normalized() if distance > 1e-9 else normal
                    result[i] = location + direction*standoff
                    moved = True
            if not moved:
                break
    def alignment(points):
        values = [angle(a,b) for a,b in zip(tangents(points),tangents(lock_guide))]
        return sum(values)/len(values)
    context['guide'] = dict(before=curve(guide), blendOnly=curve(blended), after=curve(result),
        beforeMeanLockAngleDeg=alignment(guide), afterMeanLockAngleDeg=alignment(result),
        rootLockDistanceMm=(guide[0]-lock_guide[0]).length*1000,
        blendMaxShiftMm=max((a-b).length for a,b in zip(guide,result))*1000,
        clearanceMaxShiftMm=max((a-b).length for a,b in zip(blended,result))*1000,
        pointsBefore=[list(p) for p in guide], pointsLock=[list(p) for p in lock_guide],
        pointsBlend=[list(p) for p in blended], pointsAfter=[list(p) for p in result])
    return result

def ribbon(guide,frame,layer,strip,random,lock):
    # Keep the RNG draws, guide, and strip unchanged. The candidate changes only width.
    card = original_ribbon(guide,frame,layer,strip,random,lock)
    before = ribbon_stats(card['rings'])
    if mode in ('slender','closest-slender') and layer['name'] not in ('root','underlayer'):
        factor = min(1.0,arc(guide)*0.5/(before['rootWidthMm']/1000))
        card['rings'] = [(p+(a-p)*factor,p+(b-p)*factor,s)
                         for p,(a,b,s) in zip(guide,card['rings'])]
    rows.append(dict(layer=layer['name'],strip=strip,lock=lock[0],guide=context['guide'],
                     original=before, preClamp=ribbon_stats(card['rings'])))
    return card

def assemble(basemesh,cards,shells,style,locks,edge_scale):
    context['capVertices'] = sum(len(shell['points']) for shell in shells)
    context['cards'] = cards
    return original_assemble(basemesh,cards,shells,style,locks,edge_scale)

def clamp(obj,body,frame,collide=True):
    before = [v.co.copy() for v in obj.data.vertices]
    result = original_clamp(obj,body,frame,collide)
    offset = context['capVertices']
    for row,card in zip(rows,context['cards']):
        count = len(card['rings'])*2
        pre = before[offset:offset+count]
        expected = [p for a,b,_ in card['rings'] for p in (a,b)]
        assert max((a-b).length for a,b in zip(pre,expected)) < 1e-9, 'Unexpected assembly order'
        after = [v.co.copy() for v in obj.data.vertices[offset:offset+count]]
        shifts = [(a-b).length*1000 for a,b in zip(before[offset:offset+count],after)]
        row['postClamp'] = ribbon_stats([(after[i],after[i+1],i/(count-2)) for i in range(0,count,2)])
        row['clampMaxShiftMm'] = max(shifts)
        row['clampMovedVertices'] = sum(x>1e-5 for x in shifts)
        offset += count
    assert offset == len(before)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(dict(mode=mode,rows=rows),indent=2)+'\n')
    return result

h.grow_layer = grow_layer
h.draw_into_lock = draw
h.ribbon_of = ribbon
h.assemble_cards = assemble
h.clamp_cards_off_the_body = clamp
if __name__ == '__main__':
    runpy.run_path(str(pipeline / 'build_figure.py'), run_name='__main__')
