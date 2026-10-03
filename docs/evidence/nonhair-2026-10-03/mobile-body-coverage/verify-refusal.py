"""Independent byte/scope verification of a refused observation; no projection run."""
import datetime, hashlib, json, os, pathlib, sys

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
root = pathlib.Path(__file__).resolve().parents[4]
packet = root / 'captures/mobile-body-coverage-2026-10-03-v1'
report_path = packet / 'report.json'
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
report = json.loads(report_path.read_text())
assert report['status'] == 'failed'
assert len(report['errors']) == 1 and "'taau' !== 'off'" in report['errors'][0]
assert report['backend']['isWebGPUBackend'] is True
assert report['backend']['stats']['temporalAA'] == 'taau'
assert report['backend']['stats']['resolutionScale'] == .66
assert report['images'] == []
assert all(k not in report for k in ('sample', 'coverage', 'finalState', 'finalGeometryState', 'retirement'))
assert report['cleanup'] == {'page': 'closed', 'browser': 'closed'}
assert report['finalPinsUnchanged'] is True
assert report['finished'] < report['hardStop']
for p, h in report['sources'].items():
    assert digest(root / p) == h, p
for p, h in report['dependencies'].items():
    assert digest(root / p) == h, p
for a in report['assets']:
    assert digest(root / a['file']) == a['sha256'] == report['sources'][a['file']]
instrument = root / 'tools/critic/mobile-body-coverage.mjs'
assert digest(instrument) == digest(packet / 'instrument.mjs') == report['instrumentSHA256']
assert not list(packet.glob('*.png'))
print(json.dumps({
    'status': 'verified-refusal-only',
    'reportSHA256': digest(report_path),
    'instrumentSHA256': digest(instrument),
    'verifierSHA256': digest(pathlib.Path(__file__)),
    'pins': {'sources': len(report['sources']), 'dependencies': len(report['dependencies']), 'servedGLBs': len(report['assets'])},
    'observedBackend': report['backend'],
    'scope': 'No posed support, coverage, image or completed avatar-retirement observation. Browser/page cleanup is recorded; no independent runtime visibility claim.',
    'nativeRun': {k: report[k] for k in ('started','finished','pid','status','cleanup')},
    'execution': {'command': 'python3 docs/evidence/nonhair-2026-10-03/mobile-body-coverage/verify-refusal.py > docs/evidence/nonhair-2026-10-03/mobile-body-coverage/independent.json', 'interpreter': sys.executable, 'version': sys.version.split()[0], 'pid': os.getpid(), 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat()}
}, indent=2))
