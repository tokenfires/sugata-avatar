"""Analytic controls for the exact production and isolated candidate clump projections."""
import json, math, os, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).parent))
os.environ['RIBBON_MODE'] = 'closest'
os.environ.setdefault('RIBBON_REPORT', str(Path(__file__).with_name('control-unused.json')))
import probe
probe.h.apply_style('crop01')

class Plane:
    def __init__(self, smooth_normal):
        self.tree = self
        self.normal = Vector(smooth_normal).normalized()
    def find_nearest(self, p):
        return Vector((p.x,p.y,0)), Vector((0,0,1)), 0, abs(p.z)
    def normal_at(self, triangle, location):
        return self.normal

def run(normal, z=0.005):
    guide = [Vector((i*0.002,0,z)) for i in range(17)]
    body = Plane(normal)
    result = {}
    for name,fn in [('production',probe.original_draw),('candidate',probe.draw)]:
        points=fn(guide,guide,0.5,body,0.010)
        result[name] = dict(minClearanceMm=min(p.z for p in points)*1000,
                           maxLateralShiftMm=max(abs(p.x-q.x) for p,q in zip(points,guide))*1000)
    return result

report = dict(aligned=run((0,0,1)),smoothTilt45=run((1,0,1)),insideAligned=run((0,0,1),-0.005))
for case in ('aligned','insideAligned'):
    for row in report[case].values():
        assert abs(row['minClearanceMm']-10)<0.001
        assert row['maxLateralShiftMm']<0.001
tilted=report['smoothTilt45']
assert abs(tilted['production']['minClearanceMm']-10/math.sqrt(2))<0.001
assert abs(tilted['production']['maxLateralShiftMm']-30/math.sqrt(2))<0.001
assert abs(tilted['candidate']['minClearanceMm']-10)<0.001
assert tilted['candidate']['maxLateralShiftMm']<0.001
print('PROJECTION_CONTROL '+json.dumps(report,sort_keys=True))
