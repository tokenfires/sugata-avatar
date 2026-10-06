# Root-only inert independent raw-result checks. Never imports or evaluates the JS candidate.
from pathlib import Path
import json, re, hashlib, datetime, os

leaf = Path(__file__).resolve().parent

def strict(raw):
    def pairs(items):
        out = {}
        for key, value in items:
            assert key not in out, ('duplicate JSON key', key)
            out[key] = value
        return out
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))

def pin(path):
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

job = strict((leaf / 'JOB.json').read_text())
gate = strict((leaf / 'ROOT-SOURCE-GATE.json').read_text())
for row in gate['execution_inputs']:
    assert pin(Path(row['path'])) == row, row['path']
assert job['returncode'] == 0 and job['collected'] and not job['errors'] and job['stop_reason'] is None
for channel, name in [('stdout', 'STDOUT.txt'), ('stderr', 'STDERR.txt')]:
    found = pin(leaf / name)
    recorded = job['outputs'][channel]
    assert found['bytes'] == recorded['bytes'] == recorded['observed_read_bytes']
    assert found['sha256'] == recorded['sha256']
    assert recorded['eof'] and recorded['written'] and job['pipes_closed'][channel]

stdout = (leaf / 'STDOUT.txt').read_text()
lines = stdout.splitlines()
start = strict(next(line for line in lines if line.startswith('{"candidateStarted":')))
assert start['pid'] == job['child_pid']
cases = [strict(line)['completionCase'] for line in lines if line.startswith('{"completionCase":')]
expected = ['old-consider-new-pin', 'old-pin-new-pin', 'serial-honour',
            'invalid-newer-preserves-valid-old', 'valid-failed-newer-obsoletes-unapplied-old',
            'applied-old-newer-pending-then-fails', 'two-real-commits-before-old-delivery',
            'callback-once-invalid-option-preserves-old', 'callback-throw-is-postcommit',
            'callback-reentrant-commit-snapshot-and-loading-owner', 'pin-input-alias-captured',
            'ordinary-failure-and-disposed-load-never-notify', 'ask-confirm-obsolete-to-new-user-pin']
assert [item['name'] for item in cases] == expected
summary = strict(next(line for line in lines if line.startswith('{"completionPassed":')))
assert summary['completionPassed'] == 13 and summary['pid'] == job['child_pid']
floor = {'foundation_bra', 'foundation_briefs'}
snapshots = []
for index, item in enumerate(cases):
    assert item['passed'] and 'failure' not in item
    assert item['cleanup'] == {'disposed': True, 'pendingFragments': 0}
    expected_settlement = ['fulfilled', 'fulfilled']
    if index in (3, 4, 5, 7, 10): expected_settlement = ['fulfilled', 'rejected']
    if index == 8: expected_settlement = ['rejected', 'fulfilled']
    if index == 11: expected_settlement = ['rejected', 'rejected']
    if index == 12: expected_settlement = ['fulfilled', 'fulfilled', 'fulfilled']
    assert [x['status'] for x in item['settled']] == expected_settlement, item['name']
    for stage, snapshot in [('initial', item['initial']), *item['stages'].items(), ('final', item['final'])]:
        assert set(snapshot['floor']) == floor and len(snapshot['floor']) == 2
        assert len(snapshot['worn']) == len(set(snapshot['worn']))
        assert floor <= set(snapshot['worn']) or (index == 11 and stage == 'final' and not snapshot['worn'])
        raw = snapshot['storedRaw']
        if raw is not None:
            stored = strict(raw)
            assert stored['version'] == 1
            for field in ('mode', 'pinnedOutfit', 'currentRequest', 'lastChangeAt', 'lastWornAt', 'preferences'):
                assert stored[field] == snapshot[field], (item['name'], stage, field)
        else:
            assert snapshot['mode'] == 'pinned' and snapshot['pinnedOutfit'] is None
            assert snapshot['currentRequest'] is None and snapshot['lastChangeAt'] is None
            assert not snapshot['lastWornAt'] and not snapshot['preferences']
        # Independently derive pin truth; never use reported pinHolds as the oracle.
        derived = snapshot['mode'] != 'pinned' or snapshot['pinnedOutfit'] is None or set(snapshot['pinnedOutfit']) == set(snapshot['worn'])
        assert snapshot['pinHolds'] == derived
        snapshots.append({'case': item['name'], 'stage': stage, 'currentRequest': snapshot['currentRequest'],
                          'worn': snapshot['worn'], 'lastChangeAt': snapshot['lastChangeAt'],
                          'lastWornAt': snapshot['lastWornAt'],
                          'honoured': [x['honoured'] for x in snapshot['preferences']],
                          'raw_store_bytes': 0 if raw is None else len(raw.encode())})

def request(item, ids, mode, stage='final'):
    state = item[stage] if stage in ('initial', 'final') else item['stages'][stage]
    assert state['currentRequest'] == ids and state['mode'] == mode
    assert set(state['worn']) == floor | set(ids)
    assert strict(state['storedRaw'])['currentRequest'] == ids
    if mode == 'pinned': assert set(state['pinnedOutfit']) == set(state['worn'])
    return state

for i in (0, 1, 2, 6, 12): request(cases[i], ['shoes01'], 'pinned' if i != 6 else 'agent')
for i in (3, 5): request(cases[i], ['fedora01'], 'agent')
request(cases[10], ['fedora01'], 'pinned')
for i in (0, 12):
    assert cases[i]['old']['applied'] is False and cases[i]['old']['status'] == 'superseded'
    assert [x['honoured'] for x in cases[i]['final']['preferences']] == [False]
assert cases[0]['final']['lastChangeAt'] is None and cases[0]['final']['lastWornAt'] == {}
assert set(cases[1]['oldReturnedWorn']) == floor | {'shoes01'}
assert cases[2]['old']['applied'] and cases[2]['final']['preferences'][0]['honoured']
request(cases[2], ['fedora01'], 'agent', 'considered')
assert cases[3]['old']['applied'] and cases[3]['final']['preferences'][0]['honoured']
assert cases[4]['old']['applied'] is False and cases[4]['old']['status'] == 'superseded'
assert cases[4]['final']['currentRequest'] is None and set(cases[4]['final']['worn']) == floor
assert cases[4]['final']['lastChangeAt'] is None and cases[4]['final']['lastWornAt'] == {}
assert cases[4]['final']['preferences'][0]['honoured'] is False
for stage in ('committedBeforeDelivery', 'newerPending', 'newerFailed'):
    state = request(cases[5], ['fedora01'], 'agent', stage)
    assert state['preferences'][0]['honoured'] and state['lastChangeAt'] == 1_000_000
assert cases[5]['old']['applied']
assert cases[6]['old']['applied'] and cases[6]['newer']['applied']
assert set(cases[6]['old']['worn']) == floor | {'fedora01'}
assert set(cases[6]['newer']['worn']) == floor | {'shoes01'}
assert [x['honoured'] for x in cases[6]['final']['preferences']] == [True, True]
assert cases[6]['final']['lastChangeAt'] == 1_600_001
assert cases[6]['final']['lastWornAt'] == {'fedora01': 1_600_001}
assert [set(x) for x in cases[7]['callbacks']] == [floor | {'fedora01'}]
assert set(cases[7]['returnedWorn']) == floor | {'fedora01'}
assert cases[8]['calls'] == 1 and set(cases[8]['stages']['afterThrow']['worn']) == floor | {'fedora01'}
assert set(cases[8]['final']['worn']) == floor | {'shoes01'}
assert [set(x) for x in cases[9]['callbacks']] == [floor | {'fedora01'}, floor | {'shoes01'}]
assert set(cases[9]['firstReturnedWorn']) == floor | {'fedora01'}
assert set(cases[9]['loadingAfterOldFinally']) == floor | {'shoes01'}
assert set(cases[9]['final']['worn']) == floor | {'shoes01'}
assert cases[10]['mutatedCallerIds'] == ['shoes01']
assert cases[11]['calls'] == 0 and cases[11]['final']['worn'] == []
assert cases[12]['final']['pending'] is None
assert len(snapshots) == 39 and sum(len(item['settled']) for item in cases) == 27

# Catalogue JSON is the one pretty-printed block, bounded before the original serial text gate.
catalogue_start = stdout.index('\n{\n') + 1
catalogue, consumed = json.JSONDecoder().raw_decode(stdout[catalogue_start:])
catalogue = strict(stdout[catalogue_start:catalogue_start + consumed])
expected_catalogue = re.findall(r"^    check\( '([^']+)'", (leaf / 'ORIGINAL-CatalogueDresser.selftest.mjs.txt').read_text(), re.M)
assert len(expected_catalogue) == 12
assert catalogue['pid'] == job['child_pid'] and catalogue['checks'] == expected_catalogue
assert catalogue['passed'] == len(catalogue['checks']) == 12
serial_text = stdout[catalogue_start + consumed:]
serial_passes = re.findall(r'^PASS — (\d+) assertions\.$', serial_text, re.M)
assert len(serial_passes) == 1 and 'FAIL' not in serial_text
assert len(re.findall(r'^  ok  ', serial_text, re.M)) == int(serial_passes[0])
stderr = (leaf / 'STDERR.txt').read_text()
warning = 'Figure: this rig has no jaw, eyeLeft, eyeRight bone(s) (53 bones found). Motion layers that need them must fall back — jaw to the jawOpen morph, gaze to the eyeLook* morphs.'
stderr_lines = stderr.splitlines()
known_warnings = sum(line == warning for line in stderr_lines)
other_stderr = [line for line in stderr_lines if line != warning]
assert known_warnings >= 13
assert len(other_stderr) == 1 and other_stderr[0].startswith('WardrobeAgency: sugata.wardrobe.agency.v1:gate is not JSON; starting pinned.')
receipt = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(),
           'decision': 'Independent raw candidate CPU predicates pass; critic actual review/adoption pending.',
           'inputs': [pin(leaf / name) for name in ('JOB.json', 'STDOUT.txt', 'STDERR.txt', 'ROOT-SOURCE-GATE.json', 'verify-result.py')],
           'execution_inputs_verified': len(gate['execution_inputs']), 'actual_job': job,
           'cases': 13, 'raw_snapshots': snapshots, 'owned_settlements': 27,
           'catalogue_checks': catalogue['checks'], 'serial_assertions': int(serial_passes[0]),
           'stderr': {'known_rig_warnings': known_warnings, 'other_lines': other_stderr},
           'limits': 'Raw independent CPU policy values only; no Node replay, visual/fit/AAA/performance or global lifecycle acceptance. Caller delivery seams disclosed. Original serial rigs lack dispose in source; only new13 and catalogue cleanup are asserted.'}
with (leaf / 'ROOT-ACTUAL-OBSERVATION.json').open('x') as stream:
    json.dump(receipt, stream, indent=2); stream.write('\n')
print(json.dumps({'utc': receipt['utc'], 'pid': os.getpid(), 'cases': 13, 'raw_snapshots': len(snapshots),
                  'catalogue_checks': len(catalogue['checks']), 'serial_assertions': receipt['serial_assertions'],
                  'warnings': known_warnings, 'receipt': pin(leaf / 'ROOT-ACTUAL-OBSERVATION.json')}))
