# Independent predeclared raw-result oracle; never starts/imports Node or target.
from pathlib import Path
import json, hashlib, os, datetime
leaf=Path(__file__).resolve().parent

def pin(p):
    p=Path(p); b=p.read_bytes(); return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())

def verify(r):
    a=pin(r['path']); assert all(a[k]==r[k] for k in ('path','bytes','sha256')),r['path']
gate=json.loads((leaf/'ROOT-SOURCE-GATE.json').read_text())
for row in gate['execution_inputs']: verify(row)
job=json.loads((leaf/'JOB.json').read_text())
assert job['returncode']==0 and job['stop_reason'] is None and job['collected'] is True and job['errors']==[]
assert all(job['pipes_closed'].values())
for name,file in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
    p=pin(leaf/file); j=job['outputs'][name]
    assert p['bytes']==j['bytes']==j['observed_read_bytes'] and p['sha256']==j['sha256'] and j['eof'] and j['written']
raw=[json.loads(s) for s in (leaf/'STDOUT.txt').read_text().splitlines()]
assert len(raw)==3 and raw[-1]['probeComplete'] is True and raw[-1]['cases']==2 and raw[-1]['pid']==job['child_pid']
old=['foundation_bra','foundation_briefs','female_casualsuit01','shoes01']; outer=['female_casualsuit01','shoes01']
expected=[('TORSO','foundation_vest',['foundation_briefs','foundation_vest']),('HIPS','foundation_boxer_brief',['foundation_boxer_brief','foundation_bra'])]
findings=[]
for entry,(slot,next,floor) in zip(raw[:2],expected):
    r=entry['foundationCase']; s=r['states']; assert r['slot']==slot and r['next']==next and r['complete'] and 'unexpectedFailure' not in r
    assert set(s)=={'initial','selectedSaved','afterRecipe','afterControl','disposed'}
    assert r['initialRequest']==outer and r['recipeRequest']==old and r['controlRequest']==outer
    assert [j['label'] for j in r['settlements']]==['initial','currentCallerRecipe','replacementControl']
    assert [j['status'] for j in r['settlements']]==['fulfilled','rejected','fulfilled']
    assert [j['request'] for j in r['settlements']]==[outer,old,outer]
    assert r['settlements'][0]['returnedWorn']==old and r['settlements'][2]['returnedWorn']==floor+outer
    assert [d['status'] for d in r['drained']]==['fulfilled','rejected','fulfilled']
    assert r['recipeError']['name']=='Error' and r['recipeError']['message']==r['settlements'][1]['message']==r['drained'][1]['message']
    assert 'Wardrobe: this outfit cannot be worn:' in r['recipeError']['message'] and ('both claim '+slot+' at layer FOUNDATION') in r['recipeError']['message']
    pref={slot:next}; value=json.dumps(pref,separators=(',',':'))
    for name,state in s.items():
        assert state['pending']==0 and state['loadingOutfit'] is None
        assert all(j['status']=='fulfilled' for j in state['loads'])
        assert state['disposed']==(name=='disposed') and state['bodyVisible']==(name!='disposed')
        assert state['token']=={'initial':1,'selectedSaved':1,'afterRecipe':1,'afterControl':2,'disposed':3}[name]
        assert state['worn']==([] if name=='disposed' else floor+outer if name=='afterControl' else old)
        assert state['floor']==(['foundation_bra','foundation_briefs'] if name=='initial' else floor)
        assert state['preference']==({} if name=='initial' else pref)
        if name=='initial': assert state['storedRaw'] is None and state['memoryWrites']==[]
        else:
            assert state['storedRaw']==value and json.loads(state['storedRaw'])==pref
            assert state['memoryWrites']==[{'key':'sugata.wardrobe.foundation.v1:browsercheck','value':value}]
        ids=[j['id'] for j in state['loads']]; assert ids==(old if name in ['initial','selectedSaved','afterRecipe'] else old+[next])
        assert state['resident']==([] if name=='disposed' else ids)
        for j in state['loads']: assert j['url']==(leaf.parents[3]/'assets/wardrobe'/j['id']/'g050.glb').as_uri()
    assert s['selectedSaved']==s['afterRecipe'] and r['figureDisposeCalled'] is True
    findings.append({'slot':slot,'recipe_error':r['recipeError'],'selected_memory_preference':pref,'old_worn_retained':s['afterRecipe']['worn'],'control_applied':s['afterControl']['worn'],'recipe_new_load_count':0,'control_new_load_count':1})
warning="Figure: this rig has no jaw, eyeLeft, eyeRight bone(s) (53 bones found). Motion layers that need them must fall back — jaw to the jawOpen morph, gaze to the eyeLook* morphs."
assert (leaf/'STDERR.txt').read_text().splitlines()==[warning,warning]
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'writer_pid':os.getpid(),'decision':'Actual two exactcaller recipes refuse before token/load and retain old worn IDs; selected/saved memory preferences changed; paired explicit outer controls apply current floor.','verified_execution_inputs':len(gate['execution_inputs']),'raw_cases':2,'raw_states':10,'settlements':6,'known_warnings':2,'findings':findings,'inputs':[pin(leaf/n) for n in ['ROOT-SOURCE-GATE.json','JOB.json','STDOUT.txt','STDERR.txt','check-raw.py']],'limits':'Real-source CPU policyIDs and private memory only; no actualtestbed catch/DOM/UI/personalstorage/pin/persistence rollback/broadconcurrency/body coverage/fit/renderer/pixels/performance/AAA.'}
with (leaf/'ROOT-OBSERVATION.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result,indent=2))
