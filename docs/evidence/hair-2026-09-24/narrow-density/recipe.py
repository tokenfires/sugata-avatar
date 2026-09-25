"""Isolated crop01 density experiment; record the exact style and lock sites."""
import copy, hashlib, json, os, runpy, sys
from pathlib import Path
pipeline = Path.cwd() / 'tools/figure-pipeline'
sys.path.insert(0, str(pipeline))
import hair_cards as h

arm = os.environ['DENSITY_ARM']
assert arm in ('baseline', 'double')
out = Path(os.environ['DENSITY_RECORD'])
record = dict(arm=arm, sourceSha256=hashlib.sha256((pipeline/'hair_cards.py').read_bytes()).hexdigest())
original_style, original_locks = h.apply_style, h.place_locks

def apply_style(style):
    result = original_style(style)
    assert style == 'crop01'
    before = copy.deepcopy(result)
    if arm == 'double':
        for layer in h.HAIR_LAYERS:
            layer['cards'] *= 2
            layer['half_width'] /= 2
    after = copy.deepcopy(result)
    record.update(before=before, after=after)
    return result

def place_locks(basemesh, frame, arguments):
    assert arguments.gender == 0.5
    locks = original_locks(basemesh, frame, arguments)
    record.update(gender=arguments.gender, seed=arguments.hair_seed, locks=[dict(
        position=list(lock.position), normal=list(lock.normal),
        direction_bias=list(lock.direction_bias), curl_bias=list(lock.curl_bias),
        cut_bias=lock.cut_bias) for lock in locks])
    out.write_text(json.dumps(record, indent=2)+'\n')
    return locks

h.apply_style, h.place_locks = apply_style, place_locks
runpy.run_path(str(pipeline/'build_figure.py'), run_name='__main__')
