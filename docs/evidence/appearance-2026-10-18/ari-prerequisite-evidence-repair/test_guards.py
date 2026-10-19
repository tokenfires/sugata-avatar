"""Synthetic evidence duties only: no main, subprocess, archive or geometry call."""
import signal
signal.alarm(5)
import copy
import datetime
import hashlib
import io
import json
import os
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
import run_once as collector
import inspect_saved as observer

START = time.monotonic()
CASES = []


class Files:
    def __init__(self, entries):
        self.entries = entries
        self.calls = []

    def __truediv__(self, name):
        owner = self
        class File:
            def open(self, mode):
                assert mode == 'rb'
                owner.calls.append('read:'+name)
                value = owner.entries[name]
                if 'read_error' in value:
                    raise OSError(value['read_error'])
                return io.BytesIO(value['raw'])

            def stat(self):
                owner.calls.append('stat:'+name)
                if name not in owner.entries:
                    raise FileNotFoundError(name)
                value = owner.entries[name]
                if 'stat_error' in value:
                    raise OSError(value['stat_error'])
                return SimpleNamespace(st_size=value.get('size',len(value.get('raw',b''))))
        return File()


def receipt_attempt(job, fail=False):
    original = collector.save; calls = []
    def save(name, value):
        calls.append({'name':name,'phases':[x['phase'] for x in value['errors']]})
        if fail:
            raise OSError('synthetic receipt write refusal')
    collector.save = save
    try:
        returned = collector.persist_job(job)
    finally:
        collector.save = original
    assert len(calls) == 1 and calls[0]['name'] == 'JOB.json'
    return returned, calls


def record(name, observations):
    assert len(CASES) < 64
    CASES.append({'name':name,'pass':True,'observations':observations})


def evidence_cases():
    names = ['RESULT.json','STDOUT.txt','STDERR.txt','JOB.json']
    files = Files({'RESULT.json':{'read_error':'must not read','stat_error':'must not stat'},
                   'STDOUT.txt':{'raw':b'out'},'STDERR.txt':{'raw':b''}})
    errors = []
    result = collector.final_evidence(False,names,errors,files)
    assert result['result'] is None and result['result_state'] == 'withheld_uncollected'
    assert not result['sizes_complete'] and result['observed_bytes'] == 3 and not errors
    assert 'read:RESULT.json' not in files.calls and 'stat:RESULT.json' not in files.calls
    assert files.calls == ['stat:STDOUT.txt','stat:STDERR.txt','stat:JOB.json']
    ok, calls = receipt_attempt({'errors':errors,'evidence':result})
    assert ok and calls[0]['phases'] == []
    record('uncollected_child_output_withheld',{'calls':files.calls,'receipt_attempts':len(calls)})

    files = Files({'RESULT.json':{'read_error':'synthetic denied','size':8},
                   'STDOUT.txt':{'stat_error':'synthetic stdout stat failure'},
                   'STDERR.txt':{'stat_error':'synthetic stderr stat failure'}})
    errors = []
    result = collector.final_evidence(True,names,errors,files)
    assert result['result'] is None and result['result_state'] == 'inspection_error'
    assert not result['sizes_complete']
    phases = [x['phase'] for x in errors]
    assert phases == ['result_inspection','stat_STDOUT.txt','stat_STDERR.txt']
    assert files.calls == ['read:RESULT.json','stat:RESULT.json','stat:STDOUT.txt','stat:STDERR.txt','stat:JOB.json']
    ok, calls = receipt_attempt({'errors':errors,'evidence':result})
    assert ok and calls[0]['phases'] == phases
    record('independent_errors_reach_receipt',{'phases':phases,'receipt_attempts':len(calls)})

    job = {'errors':[]}; ok, calls = receipt_attempt(job,fail=True)
    assert not ok and job['receipt_written'] is False
    assert [x['phase'] for x in job['errors']] == ['write_JOB']
    record('receipt_failure_returned',{'written':job['receipt_written'],'attempts':len(calls)})

    raw = b'{"synthetic":true}\n'
    files = Files({'RESULT.json':{'raw':raw},'STDOUT.txt':{'raw':b'out'},'STDERR.txt':{'raw':b''}})
    errors = []; result = collector.final_evidence(True,names,errors,files)
    assert result['result'] == {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    assert result['result_state'] == 'finalized_read' and result['sizes_complete'] and not errors
    assert result['observed_bytes'] == len(raw)+3
    job = {'errors':errors}; ok, calls = receipt_attempt(job)
    assert ok and job['receipt_written'] is True
    record('finalized_success_identity',{'raw_bytes':len(raw),'receipt_attempts':len(calls)})


def certificate_cases():
    stations = [[0.0,1.0,2.0],[0.0,1.0,2.0],[0.0,1.0,2.0]]
    good = {'axis':0,'other_axes':[1,2],'column_indices':[1,2],'scale_exponent':3,
            'node':{'indices':[0,1,2],'strict_outside_axis':0,'scale_exponent':3}}
    assert observer.validate_node_column(good,stations) == [0,1,2]
    record('on_column_link_accepted',{'indices':[0,1,2]})
    changes = [
        ('different_valid_column',lambda x:x['node'].update(indices=[0,0,2])),
        ('negative_index',lambda x:x['node'].update(indices=[-1,1,2])),
        ('out_of_range_index',lambda x:x['node'].update(indices=[3,1,2])),
        ('bool_index',lambda x:x['node'].update(indices=[False,1,2])),
        ('wrong_axis',lambda x:x.update(axis=1)),
        ('bool_axis',lambda x:x.update(axis=False)),
        ('wrong_other_axes',lambda x:x.update(other_axes=[2,1])),
        ('wrong_outside_axis',lambda x:x['node'].update(strict_outside_axis=1)),
        ('negative_column',lambda x:x.update(column_indices=[-1,2])),
        ('column_out_of_range',lambda x:x.update(column_indices=[1,3])),
        ('bool_column',lambda x:x.update(column_indices=[True,2])),
        ('wrong_scale',lambda x:x['node'].update(scale_exponent=4)),
    ]
    for name, mutate in changes:
        case = copy.deepcopy(good); mutate(case)
        try:
            observer.validate_node_column(case,stations)
        except AssertionError:
            record(name,{'rejected':True})
        else:
            raise AssertionError('invalid certificate admitted: '+name)


if __name__ == '__main__':
    evidence_cases(); certificate_cases()
    report = {'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),
              'elapsed_seconds':time.monotonic()-START,'status':'PASS_SYNTHETIC_ONLY',
              'cases':CASES,'limits':'No worker/kernel import, process spawn, archive/source decode, OS fault, real certificate, geometry or appearance qualification.'}
    raw = (json.dumps(report,separators=(',',':'))+'\n').encode()
    assert len(raw) <= 4096
    sys.stdout.buffer.write(raw); sys.stdout.buffer.flush()
