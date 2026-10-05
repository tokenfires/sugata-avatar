"""Metadata and inert syntax only; never imports prepared modules or geometry."""
import ast
import datetime
import difflib
import hashlib
import json
import pathlib
import subprocess
import tomllib

packet = pathlib.Path(__file__).resolve().parent
root = packet.parents[3]
checked = []
def check(row, override=None):
    p = pathlib.Path(override or row['path'])
    p = p if p.is_absolute() else root / p
    raw = p.read_bytes()
    assert len(raw) == row['bytes'], str(p)
    assert hashlib.sha256(raw).hexdigest() == row['sha256'], str(p)
    checked.append({'path': str(p), 'bytes': len(raw), 'sha256': row['sha256']})
def walk(x):
    if isinstance(x, dict):
        if {'path', 'bytes', 'sha256'} <= set(x):
            check(x)
        else:
            for v in x.values(): walk(v)
    elif isinstance(x, list):
        for v in x: walk(v)

plan = json.loads((packet/'PLAN.json').read_text())
source = json.loads((packet/'SOURCE-INPUTS.json').read_text())
inputs = json.loads((packet/'INPUTS.json').read_text())
walk(source); walk(inputs)
initial = json.loads((packet/'preflight/INITIAL.json').read_text())
oldpaths = {}
for row in initial['snapshots']:
    check(row, row['snapshot'])
    oldpaths[row['original']] = row['snapshot']
oldsource = json.loads((packet/'preflight/SOURCE-INPUTS.json.initial').read_text())
for row in oldsource['sources']: check(row, oldpaths.get(row['path']))
reuse = json.loads((packet/'REUSE.json').read_text())
for row in reuse['originals']:
    check(row, row['snapshot']); check(row, row['original'])
assert (packet/'exact.py').read_bytes() == (packet/'reuse/exact.py.source').read_bytes()
diff = ''
for name in ['panel.py','spatial.py','author.py','runner.py','SOURCE.md']:
    diff += ''.join(difflib.unified_diff((packet/'preflight'/f'{name}.initial').read_text().splitlines(True),
               (packet/name).read_text().splitlines(True), fromfile=f'preflight/{name}.initial', tofile=name))
assert diff == (packet/'CODE.diff').read_text()
for name in ['exact.py','spatial.py','panel.py','audit.py','author.py','runner.py']:
    # Compile the AST without executing even module-level definitions/imports.
    compile(ast.parse((packet/name).read_text(), filename=name), name, 'exec')
critic = json.loads((packet/'CRITIC-RECEIPT.json').read_text())
walk(critic)
gate = datetime.datetime.fromisoformat(plan['sourceSaveGate'])
assert datetime.datetime.fromisoformat(critic['savedUtc']) < gate
assert critic['sourceBindings'] == source['sources']
assert critic['originalInputs'] == inputs['inputs']
assert critic['sourceSaveGate'] == plan['sourceSaveGate']
assert critic['rootCloseGate'] == plan['rootCloseGate']
for name in ['CRITIC-RECEIPT.json','root-check.py']:
    p = packet/name; raw = p.read_bytes()
    check({'path':str(p),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
now = datetime.datetime.now(datetime.UTC)
assert now < datetime.datetime.fromisoformat(plan['rootCloseGate'])
automation_path = pathlib.Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')
raw = automation_path.read_bytes(); automation = tomllib.loads(raw.decode())
assert automation['status'] == 'ACTIVE' and automation['rrule'] == 'FREQ=MINUTELY;INTERVAL=10'
assert automation['target_thread_id'] == '01a0ff57-d720-7db2-923f-9e3e0521216c'
review = subprocess.run(['ps','-p','1023','-o','pid=,etime=,command='],capture_output=True,text=True,check=True).stdout
assert '--port 5173 --strictPort' in review
result = {'utc':now.isoformat(),'decision':'A complete static preparation only; separate fresh sole-CPU worth/admission required',
          'bindingRowsVerified':len(checked),'uniquePayloads':len({r['path'] for r in checked}), 'bindings':checked,
          'rootInspection':'Full six active modules, source, planning, reuse/snapshots, exact recording-only diff and final collected critic handoff independently read. Inert compile only; no prepared-module import, source reconstruction or geometry evaluation.',
          'sourceGate':plan['sourceSaveGate'],'rootCloseGate':plan['rootCloseGate'],
          'automation':{'status':automation['status'],'rrule':automation['rrule'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},
          'reviewServer':review.strip(),'ownedCandidateOrNativeJobs':[],
          'limits':'Source review cannot qualify numerical data, fit, fabric, motion, GPU or AAA appearance.'}
with (packet/'ROOT-RESULT.json').open('x') as f: f.write(json.dumps(result,indent=2)+'\n')
print(now.isoformat(),len(checked),result['uniquePayloads'])
