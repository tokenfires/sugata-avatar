from pathlib import Path
from decimal import Decimal, getcontext
from datetime import datetime, timezone
import hashlib, json, os
getcontext().prec = 60
base = Path(__file__).resolve().parent
started = datetime.now(timezone.utc).isoformat()
raw = (base / 'AUTHOR-JOB.json').read_bytes()
job = json.loads(raw, parse_float=Decimal)
w = job['witness']
a, b, c = w['points']
u = [b[i] - a[i] for i in range(3)]
v = [c[i] - a[i] for i in range(3)]
area_vector = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
area = sum(x*x for x in area_vector).sqrt()
dot = sum(area_vector[i]*w['expected'][i] for i in range(3))
assert job['status'] == 'failed' and job['outputs'] == []
assert (w['face'], w['triangle'], w['indices']) == (368, 737, [223, 421, 420])
assert all(abs(area_vector[i]-w['areaVector'][i]) < Decimal('1e-17') for i in range(3))
assert abs(area-w['area']) < Decimal('1e-17')
assert abs(dot-w['dot']) < Decimal('1e-17')
assert area > w['thresholds']['minimumTriangleAreaVector']
assert dot < 0 < w['thresholds']['minimumOutwardDot']
pins = {name: hashlib.sha256((base/name).read_bytes()).hexdigest() for name in job['inputs']}
assert pins == job['inputs']
assert not (base/'sweater.json').exists() and not (base/'sweater.obj').exists()
result = {'pid': os.getpid(), 'started': started, 'finished': datetime.now(timezone.utc).isoformat(),
 'scope': 'Saved JSON operands and source hashes only; no generator, body parse, surface or geometry evaluation',
 'rawJobSha256': hashlib.sha256(raw).hexdigest(), 'readerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'areaVectorDecimal': list(map(str, area_vector)), 'areaDecimal': str(area), 'dotDecimal': str(dot),
 'pins': pins, 'outputsAbsent': True, 'status': 'passed'}
with (base/'CRITIC-WITNESS.json').open('x') as f: json.dump(result, f, indent=2); f.write('\n')
print(json.dumps(result))
