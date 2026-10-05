"""Metadata-only handoff reconciliation; does not parse/evaluate geometry."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import tomllib

packet = pathlib.Path(__file__).resolve().parent
repository = packet.parents[3]
critic = json.loads((packet / 'CRITIC-RECEIPT.json').read_text())
supplement = json.loads((packet / 'FINAL-BINDING-RECEIPT.json').read_text())
source = json.loads((packet / 'FINAL-SOURCE.json').read_text())
plan = json.loads((packet / 'PLAN.json').read_text())
rows = (critic['originalInputs'] + critic['sourceBindings'] + critic['extraBindings']
        + critic['finalSourceBindings'] + [critic['result'], critic['historicalReceipt']]
        + supplement['bindings'] + [supplement['manifest'], supplement['result'],
        supplement['currentCriticReceipt'], supplement['historicalInitialReceipt']]
        + source['bindings'])
for row in rows:
    payload = (repository / row['path']).read_bytes()
    assert len(payload) == row['bytes'], row['path']
    assert hashlib.sha256(payload).hexdigest() == row['sha256'], row['path']
assert source['bindings'] == critic['finalSourceBindings'] == supplement['bindings']
initial = json.loads((packet / 'CRITIC-RECEIPT.initial.json').read_text())
for key in ['savedUtc', 'decision', 'sourceSaveGate', 'rootCloseGate', 'originalInputs',
            'sourceBindings', 'result']:
    assert initial[key] == critic[key], key
assert initial['extraBindings'] == critic['extraBindings'][:2]
gate = datetime.datetime.fromisoformat(plan['sourceSaveGate'])
assert datetime.datetime.fromisoformat(critic['finalReceiptSavedUtc']) < gate
assert datetime.datetime.fromisoformat(supplement['utc']) < gate
now = datetime.datetime.now(datetime.UTC)
assert now < datetime.datetime.fromisoformat(plan['rootCloseGate'])
automation_path = pathlib.Path('/Users/robault/.codex/automations/advance-sugata-avatar-visual-quality/automation.toml')
automation_bytes = automation_path.read_bytes()
automation = tomllib.loads(automation_bytes.decode())
assert automation['status'] == 'ACTIVE'
assert automation['rrule'] == 'FREQ=MINUTELY;INTERVAL=10'
assert automation['target_thread_id'] == '01a0ff57-d720-7db2-923f-9e3e0521216c'
review = subprocess.run(['ps', '-p', '1023', '-o', 'pid=,etime=,command='],
                        capture_output=True, text=True, check=True).stdout
assert '--port 5173 --strictPort' in review
result = {'utc': now.isoformat(), 'bindingRowsVerified': len(rows),
          'uniquePayloads': len({row['path'] for row in rows}),
          'decision': 'A combined artist source contract, conditional fresh constructor preparation only; B execution/native now',
          'scope': 'Root fully read both critic handoffs and source/addendum, manually reconciled topology/representation obligations; all hashes verified; no metric or geometry evaluation',
          'receiptChronology': 'Initial root999fe8 read occurred while critic publication was active; d9d992 reread complete final plus supplemental after ready/collected; exact initial retained, decision/result unchanged',
          'bindings': rows, 'sourceGate': plan['sourceSaveGate'], 'closeGate': plan['rootCloseGate'],
          'automation': {'path': str(automation_path), 'bytes': len(automation_bytes),
                         'sha256': hashlib.sha256(automation_bytes).hexdigest(),
                         'status': automation['status'], 'rrule': automation['rrule']},
          'reviewServer': review.strip(), 'ownedCandidateOrNativeJobs': [],
          'critic': 'Final collected; no further source edits'}
destination = packet / 'ROOT-RESULT.json'
with destination.open('x') as stream:
    stream.write(json.dumps(result, indent=2) + '\n')
print(result['utc'], result['bindingRowsVerified'], result['uniquePayloads'], result['decision'])
