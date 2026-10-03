"""Read retained bytes/state only; no runtime, observer, or Reset execution."""
import collections
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path('/Users/robault/GitHub/sugata-avatar')
PACKET = ROOT / 'docs/evidence/nonhair-2026-10-03/hair-draft-reset'
RAW = ROOT / 'captures/hair-draft-reset-2026-10-03-v1'
START = datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def read(path):
    return json.loads(Path(path).read_text())

pins = {}
def pin(path, expected=None):
    path = Path(path)
    actual = sha(path)
    if expected is not None:
        assert actual == expected, (str(path), actual, expected)
    pins[str(path.relative_to(ROOT))] = actual
    return actual

report = read(RAW / 'report.json')
supervisor = read(PACKET / 'supervisor-v1.json')
baseline = read(PACKET / 'BASELINE.json')
edit = read(PACKET / 'EDIT.json')
restoration = read(PACKET / 'RESTORE.json')
for path in [RAW / 'report.json', PACKET / 'supervisor-v1.json',
             PACKET / 'job-v1.log', PACKET / 'BASELINE.json',
             PACKET / 'EDIT.json', PACKET / 'RESTORE.json']:
    pin(path)
assert pins[str((RAW / 'report.json').relative_to(ROOT))] == 'de2542cc1c7edbbb279c8e946ca9edc84fda7b93433fb47fc8a43b264285ce78'
assert report['status'] == supervisor['status'] == 'failed'
assert report['pid'] == supervisor['childPID'] == 59579
assert supervisor['pid'] == 59568 and supervisor['exitCode'] == 1

assert len(report['sources']) == 380
assert len(restoration['files']) == len(edit['files']) == 3
restored = {}
for name, native_hash in report['sources'].items():
    if name in edit['files']:
        assert native_hash == edit['files'][name]
        candidate = PACKET / (Path(name).name + '.candidate')
        original = PACKET / (Path(name).name + '.original')
        pin(candidate, native_hash)
        pin(original, baseline['pins'][name])
        pin(ROOT / name, restoration['files'][name])
        assert restoration['files'][name] == baseline['pins'][name]
        assert (ROOT / name).read_bytes() == original.read_bytes()
        restored[name] = {'nativeCandidateSHA256': native_hash,
                          'restoredSHA256': restoration['files'][name]}
    else:
        pin(ROOT / name, native_hash)
for name, value in baseline['pins'].items():
    pin(ROOT / name, value)
for name, value in report['inputs'].items():
    pin(PACKET / name, value)
pin(PACKET / 'capture.mjs', report['instrumentSHA256'])
for name, value in supervisor['inputs'].items():
    pin(PACKET / name, value)
assert report['finalPinsUnchanged'] is supervisor['pinsUnchanged'] is True
assert len(report['assets']) == 6
for asset in report['assets']:
    assert asset['case'] == 'original'
    pin(ROOT / asset['file'], asset['sha256'])
    assert asset['sha256'] == report['sources'][asset['file']]

assert len(report['cases']) == 1 and not report['images']
row = report['cases'][0]
assert row['name'] == 'original' and len(row['states']) == 2
loaded, dirty = row['states']
assert [loaded['label'], dirty['label']] == ['loaded', 'compound-dirty']
keys = ['configuration', 'url', 'storage', 'attached', 'clock', 'paused', 'rawHair']
for key in keys:
    assert loaded[key] == dirty[key], key
for state in [loaded, dirty]:
    assert state['ownerSame'] is True
    assert state['backend'] == 'webgpu' and state['webGPU'] is True
    assert state['paused'] == 'true' and state['clock'] == {'motion': 0, 'utterance': 0}
assert loaded['applyDisabled'] is loaded['resetDisabled'] is True
assert dirty['applyDisabled'] is dirty['resetDisabled'] is False
assert dirty['fields']['hair-shade']['value'] == 'custom'
assert dirty['fields']['hair-tint-enabled']['checked'] is True
assert dirty['fields']['hair-tint-colour']['value'] == '#224466'
assert dirty['fields']['hair-tint-amount']['value'] == '63'
assert dirty['fields']['hair-lightness']['value'] == '61'
assert loaded['configuration'].get('hairColour') is None
assert loaded['configuration'].get('hairTint') is None
assert loaded['attached']['hair']['loadedStyle'] == 'bob02'
assert loaded['attached']['hair']['colour']['matchesAttached'] is True
assert loaded['attached']['hair']['colour']['requested'] is None
assert len(report['errors']) == 2
assert '3 !== 1' in report['errors'][0]['text']
assert 'no Reset navigation' in report['errors'][0]['text']
assert 'no Reset navigation' in report['errors'][1]['text'] and '3 !== 1' in report['errors'][1]['text']
assert len(report['failedResources']) == 48
for failure in report['failedResources']:
    assert failure['case'] == 'original'
    assert failure['failure']['errorText'] == 'net::ERR_ABORTED'
    assert set(failure) == {'case', 'url', 'failure'}
assert len(report['warnings']) == 4
assert len(report['retirements']) == 1
retirement = report['retirements'][0]
assert retirement['label'] == 'partial-final'
assert retirement['attempts'] == [{'name': name, 'status': 'returned'} for name in ['attention', 'controls', 'avatar']]
assert retirement['errors'] == []
assert retirement['disposal']['disposed'] is True and retirement['disposal']['leaked'] == []
assert report['cleanup'] == {'partial-final': 'page closed', 'browserIsConnected': False}
assert supervisor['forced'] is False and len(supervisor['owned']) == 7
for key in ['survivors', 'observedGroupRemainders', 'finalLiveRecordedIdentities', 'finalObservedGroupMembers']:
    assert supervisor[key] == [], key
assert not list(RAW.glob('*.png'))
assert sorted(p.name for p in RAW.iterdir()) == ['report.json']

# Metadata observation only. Do not execute native/supervisor/guard code.
owned_ids = sorted(map(int, supervisor['owned']))
ps_command = ['ps', '-p', ','.join(map(str, owned_ids)), '-o', 'pid=']
ps = subprocess.run(ps_command, capture_output=True, text=True)
assert ps.returncode in [0, 1]
present_ids = sorted(int(line.strip()) for line in ps.stdout.splitlines() if line.strip())
assert present_ids == [], present_ids

result = {
    'status': 'retained-refusal-and-restoration-verified',
    'pid': os.getpid(), 'started': START,
    'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'command': 'python3 docs/evidence/nonhair-2026-10-03/hair-draft-reset/critic-refusal-readback.py',
    'interpreter': sys.executable, 'version': sys.version,
    'readerSHA256': sha(Path(__file__)), 'pins': pins,
    'nativeReportSHA256': sha(RAW / 'report.json'),
    'supervisorSHA256': sha(PACKET / 'supervisor-v1.json'),
    'sourceComparison': {'nativeSources': 380, 'unchangedCurrentSources': 377,
                         'intentionallyRestoredCandidatePaths': restored},
    'actualAssets': len(report['assets']), 'nativeCases': 1, 'states': 2,
    'preservedStateKeys': keys, 'retainedImages': 0,
    'primaryFailure': report['errors'][0]['text'],
    'errors': 2, 'failedResources': 48, 'warningCounts': dict(collections.Counter(w['text'] for w in report['warnings'])),
    'resetExecuted': False, 'fourCaseQualification': False,
    'partialRetirement': retirement, 'cleanup': report['cleanup'],
    'ownedMetadataRead': {'command': ps_command, 'returncode': ps.returncode,
                         'recordedIDs': owned_ids, 'presentIDs': present_ids},
    'limits': ['No runtime, Reset, guard, observer, or event replay.',
               'No retained image exists and no appearance/layout/keyboard/Reset behavior is qualified.',
               'Frame events lack URLs/times/document identities; aborted requests lack temporal/document attribution.',
               'Current absence applies only to seven recorded PID numbers; no unobserved-descendant/global absence guarantee.',
               'Final native pins were recorded before the deliberate exact three-file restoration.']
}
target = PACKET / 'critic-refusal-readback.json'
with target.open('x') as f:
    json.dump(result, f, indent=2); f.write('\n')
print(json.dumps({'status': result['status'], 'pid': result['pid'], 'started': result['started'],
                  'finished': result['finished'], 'pins': len(pins), 'readerSHA256': result['readerSHA256'],
                  'receiptSHA256': sha(target)}))
