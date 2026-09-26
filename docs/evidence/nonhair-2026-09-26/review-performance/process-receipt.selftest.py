import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
sys.dont_write_bytecode = True

p = Path(__file__).with_name('process-receipt.py')
spec = importlib.util.spec_from_file_location('receipt', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def reject(fn):
    try:
        fn()
    except (RuntimeError, UnicodeDecodeError):
        return
    raise AssertionError('Expected refusal')


argv = ['/tmp/program with spaces', '--a=two words', '', 'é']
raw = struct.pack('=i', len(argv)) + argv[0].encode() + b'\0\0\0' + b'\0'.join(a.encode() for a in argv) + b'\0SECRET=\xff\xfe\0'
assert m.parse_procargs(raw)['argv'] == argv  # Invalid UTF-8 in trailing environment must never decode.
reject(lambda: m.parse_procargs(raw[:4]))
reject(lambda: m.parse_procargs(struct.pack('=i', 0) + raw[4:]))
reject(lambda: m.parse_procargs(struct.pack('=i', 100000) + raw[4:]))
reject(lambda: m.parse_procargs(raw[:raw.index(b'SECRET') - 1]))
base = {'pid': 12, 'ppid': 10, 'argv': ['/tmp/chrome', '--headless', '--remote-debugging-pipe', '--no-startup-window', '--user-data-dir=/tmp/playwright_chromiumdev_profile-test']}
assert m.select_browser([base], 10, set(), ['--headless']) is base
reject(lambda: m.select_browser([base, {**base, 'pid': 13}], 10, set(), []))
reject(lambda: m.select_browser([base], 10, {12}, []))
reject(lambda: m.select_browser([base], 99, set(), []))
reject(lambda: m.select_browser([base], 10, set(), ['--enable-unsafe-webgpu']))
reject(lambda: m.select_browser([{**base, 'argv': base['argv'] + ['--type=gpu-process']}], 10, set(), []))

# A disposable Python child proves native argument boundaries and birth identity without a browser.
command = [sys.executable, '-c', 'import time; time.sleep(20)', 'two words', '', 'é']
child = subprocess.Popen(command)
try:
    record = m.read_process(child.pid, os.getpid())
    assert record['argv'] == command
    assert record['pid'] == child.pid and record['ppid'] == os.getpid()
    assert record == m.read_process(child.pid, os.getpid())
    assert os.path.realpath(record['executable']) == os.path.realpath(sys.executable)
    reject(lambda: m.read_process(child.pid, os.getpid() + 1))
finally:
    child.terminate()
    child.wait(timeout=5)

print(json.dumps({'groups': 4, 'parserBoundaries': True, 'environmentNotDecoded': True, 'ambiguityAndScopeRefusal': True,
                  'actualHarmlessChildArgvAndBirthIdentity': True, 'scope': 'CPU/native OS receipt only; no browser or GPU launched.'}))
