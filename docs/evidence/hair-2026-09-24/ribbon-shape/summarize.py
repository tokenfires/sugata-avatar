"""Summarize the saved per-card diagnostic without losing its precise measurement definitions."""
import hashlib, json, math, statistics
from pathlib import Path

root=Path('tmp/hair-sep24/ribbon-shape')
report={'definitions': {
    'foldedGuide': 'At least one pair of adjacent segments, both >=0.1 mm, has negative dot product (>90 degrees). The length floor excludes near-zero Float32 steps; this is a diagnostic, not an acceptance gate.',
    'frameFlip': 'At least one pair of adjacent right-minus-left ribbon vectors differs by >90 degrees.',
    'rootShift': 'Euclidean movement of guide point zero during draw_into_lock, before ribbon widening and final vertex clearance.',
    'widthArm': 'Limit full root width to half of the post-clump arc length for mass, body, surface, flyaway, veil, fringe; preserve root and underlayer coverage cards. Keep guide, RNG draws and atlas strip unchanged.',
    'closestArm': 'Only draw_into_lock clearance: for an outside point use its normalized closest-point displacement instead of the interpolated shading normal. Existing inside/zero-distance fallback and three passes remain.'}, 'arms': {}}

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def folded(points):
    segments=[[b-a for a,b in zip(p,q)] for p,q in zip(points,points[1:])]
    return any(math.hypot(*a)>=.0001 and math.hypot(*b)>=.0001 and sum(x*y for x,y in zip(a,b))<0
               for a,b in zip(segments,segments[1:]))

def summarize(rows):
    return {'cards':len(rows),
      'foldedGuideCards':{s:sum(folded(r['guide'][s]) for r in rows) for s in ['pointsBefore','pointsBlend','pointsAfter']},
      'frameFlipCards':{s:sum(r[s]['maxAcrossTurnDeg']>90 for r in rows) for s in ['preClamp','postClamp']},
      'rootShiftOver1mmCards':sum(math.dist(r['guide']['pointsBefore'][0],r['guide']['pointsAfter'][0])>.001 for r in rows),
      'medianGuideClearanceMaxShiftMm':statistics.median(r['guide']['clearanceMaxShiftMm'] for r in rows),
      'ribbonAspectUnder1Cards':sum(r['preClamp']['aspect']<1 for r in rows),
      'ribbonAspectUnder2Cards':sum(r['preClamp']['aspect']<2 for r in rows),
      'medianPreClampArcMm':statistics.median(r['preClamp']['arcMm'] for r in rows),
      'medianPreClampRootWidthMm':statistics.median(r['preClamp']['rootWidthMm'] for r in rows),
      'finalCornerShiftOver1mmCards':sum(r['clampMaxShiftMm']>1 for r in rows)}

for mode in ['baseline','closest','slender','closest-slender']:
    source=root/f'{mode}.json'
    rows=json.loads(source.read_text())['rows']
    report['arms'][mode]={'rawReportSha256':sha(source),
        'assetSha256':sha(root/mode/'hair/crop01/g050.glb'),
        'overall':summarize(rows),
        'layers':{layer:summarize([r for r in rows if r['layer']==layer]) for layer in dict.fromkeys(r['layer'] for r in rows)}}
    if mode=='baseline':
        worst=max(range(len(rows)),key=lambda i:rows[i]['preClamp']['maxAcrossTurnDeg'])
        report['illustrativeCard']={'index':worst,'baseline':rows[worst]}
    if mode=='closest': report['illustrativeCard']['closest']=rows[report['illustrativeCard']['index']]

report['sourceHashes']={str(p):sha(p) for p in [root/'probe.py',root/'capture.mjs',root/'projection-control.py',
    Path('tools/figure-pipeline/hair_cards.py'),Path('tools/figure-pipeline/hair_geometry.mjs'),
    Path('tools/figure-pipeline/verify_glb.mjs'),Path('packages/testbed/src/hair.js')]}
(root/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
