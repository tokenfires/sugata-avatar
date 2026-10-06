# Independent predeclared saved-data oracle. No target/module/Node imports or replay.
from pathlib import Path
import json,hashlib,datetime,os
leaf=Path(__file__).resolve().parent

def strict(raw):
    def pairs(rows):
        d={}
        for k,v in rows:
            assert k not in d,'duplicate key';d[k]=v
        return d
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda x: (_ for _ in ()).throw(AssertionError(x)))
def pin(p):
    p=Path(p);b=p.read_bytes();return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def verify(r):
    a=pin(r['path']);assert all(a[k]==r[k] for k in ('path','bytes','sha256')),r['path']
gate=strict((leaf/'ROOT-SOURCE-GATE.json').read_text())
for row in gate['execution_inputs']:verify(row)
job=strict((leaf/'JOB.json').read_text());assert job['returncode']==0 and job['collected'] and job['errors']==[] and job['stop_reason'] is None
assert all(job['pipes_closed'].values())
for stream,name in [('stdout','STDOUT.txt'),('stderr','STDERR.txt')]:
    r=pin(leaf/name);j=job['outputs'][stream];assert r['bytes']==j['bytes']==j['observed_read_bytes'] and r['sha256']==j['sha256'] and j['eof'] and j['written']
lines=[strict(x) for x in (leaf/'STDOUT.txt').read_text().splitlines()];assert len(lines)==13
assert lines[-1]['foundationRefreshComplete'] and lines[-1]['cases']==12 and lines[-1]['pid']==job['child_pid']
outer=['female_casualsuit01','shoes01'];oldFloor=['foundation_bra','foundation_briefs'];old=oldFloor+outer
vestFloor=['foundation_briefs','foundation_vest'];boxerFloor=['foundation_boxer_brief','foundation_bra'];bothFloor=['foundation_boxer_brief','foundation_vest']
expected=[
 ('null-torso-and-same-choice',{'before','after','same'},['initialDress','torso','same']),
 ('null-hips',{'before','after'},['initialDress','hips']),
 ('active-pin-two-slots',{'before','torso','after','restored'},['initialDress','pin','torso','hips','restore']),
 ('dormant-pin-own-outers-restart',{'before','after','restarted','woken','restored'},['initialDress','pin','consider','torso','wake','restore']),
 ('preexisting-pin-drift',{'before','after'},['initialDress','pin','rogueDress','torso']),
 ('ask-pending-history',{'before','after'},['initialDress','pin','consider','propose','hips']),
 ('invalid-choice-and-user-mark',{'before','after'},['initialDress','unauthorized']),
 ('precommit-load-failure',{'before','loading','after'},['initialDress','pin','failed']),
 ('superseded-refresh',{'before','loading','newerRequested','after'},['initialDress','pin','obsolete','newerPin']),
 ('actualcommit-delivery-held',{'before','committedHeld','newerApplied','after'},['initialDress','pin','newerPin','heldDelivery']),
 ('disposed-refusal',{'before','after'},['initialDress','disposed']),
 ('postcommit-store-rejection',{'before','after'},['initialDress','pin','postcommitError'])]
failures={'unauthorized':"foundation refresh is the user's call",'failed':'owned foundation load failure','disposed':'disposed','postcommitError':'owned foundation store failure'}
fields=['mode','pending','preferences','lastChangeAt','history','clock']
counts={'cases':0,'snapshots':0,'settlements':0,'stored_documents':0,'stored_document_references':0,'foundation_saves_reparsed':0,'write_attempts':0}
caseRows=[]
for line,(name,stages,labels) in zip(lines[:-1],expected):
    r=line['foundationRefreshCase'];assert r['name']==name and r['passed'] and 'failure' not in r
    assert set(r['states'])==stages and [j['label'] for j in r['settlements']]==labels
    assert len(r['drained'])==len(labels);assert sorted(j['status'] for j in r['drained'])==sorted(j['status'] for j in r['settlements'])
    assert r['cleanup']=={'disposed':True,'pendingFragments':0,'resident':0,'worn':[]} and r['figureDisposeCalled']
    docs=[strict(raw) for raw in r['documents']];assert len(set(r['documents']))==len(docs)
    for doc in docs:assert set(doc)=={'version','mode','pinnedOutfit','lastChangeAt','lastWornAt','currentRequest','preferences'} and doc['version']==1
    def metadata(s):
        return {'version':1,'mode':s['mode'],'pinnedOutfit':s['pin'],'lastChangeAt':s['lastChangeAt'],'lastWornAt':s['history'],'currentRequest':s['request'],'preferences':s['preferences']}
    snapshots={'initial':r['initial'],**r['states'],'final':r['final']}
    for phase,s in snapshots.items():
        p=s['foundationPreference'];assert s['floor']==sorted([p.get('TORSO','foundation_bra'),p.get('HIPS','foundation_briefs')])
        if s['foundationSavedJSON'] is not None:
            assert strict(s['foundationSavedJSON'])==p;counts['foundation_saves_reparsed']+=1
        else:assert p=={}
        assert s['pinHolds']==(s['mode']!='pinned' or s['pin'] is None or sorted(s['pin'])==sorted(s['worn']))
        if s['storedDocument'] is not None:
            assert 0<=s['storedDocument']<len(docs);counts['stored_document_references']+=1
            if not (name=='postcommit-store-rejection' and phase in ['after','final']):assert docs[s['storedDocument']]==metadata(s)
        assert s['writes']<=len(r['writeAttempts'])
        if phase not in ['loading','newerRequested']:assert s['pendingFragments']==0 and s['loading'] is None
    init=r['initial'];assert init['worn']==old and init['floor']==oldFloor and init['mode']=='pinned' and init['pin'] is None and init['request'] is None and init['storedDocument'] is None and init['writes']==0 and init['token']==1 and init['clock']==1_000_000 and init['lastChangeAt'] is None and init['history']=={} and init['preferences']==[] and init['pending'] is None
    assert r['final']==r['states']['after'] if name not in ['null-torso-and-same-choice','active-pin-two-slots','dormant-pin-own-outers-restart'] else r['final']==r['states'][{'null-torso-and-same-choice':'same','active-pin-two-slots':'restored','dormant-pin-own-outers-restart':'restored'}[name]]
    for a in r['writeAttempts']:assert a['key']=='sugata.wardrobe.agency.v1:foundation-refresh:'+name and 0<=a['document']<len(docs)
    assert sum(not a['committed'] for a in r['writeAttempts'])==(1 if name=='postcommit-store-rejection' else 0)
    for j in r['settlements']:
        if j['label'] in failures:assert j['status']=='rejected' and failures[j['label']] in j['message']
        else:assert j['status']=='fulfilled'
    assert r['loads'][:4]==[{'id':id,'file':'assets/wardrobe/'+id+'/g050.glb','status':'fulfilled'} for id in old]
    for load in r['loads']:
        assert load['file']=='assets/wardrobe/'+load['id']+'/g050.glb'
        if load['status']=='rejected':assert name=='precommit-load-failure' and load['id']=='foundation_vest' and load['message']=='owned foundation load failure'
        else:assert load['status']=='fulfilled'
    before=r['states']['before'];after=r['states']['after']
    def preserve(a,b):
        for f in fields:assert b[f]==a[f],(name,f)
    if name in ['null-torso-and-same-choice','null-hips','active-pin-two-slots','dormant-pin-own-outers-restart','preexisting-pin-drift','ask-pending-history','postcommit-store-rejection']:
        preserve(before,after)
        floor=boxerFloor if name in ['null-hips','ask-pending-history'] else bothFloor if name=='active-pin-two-slots' else vestFloor
        assert after['worn']==floor+outer and after['floor']==floor
        expectedPin=None if name in ['null-torso-and-same-choice','null-hips'] else floor+['fedora01'] if name in ['dormant-pin-own-outers-restart','preexisting-pin-drift','ask-pending-history'] else floor+outer
        assert after['pin']==expectedPin and after['request']==(None if name in ['null-torso-and-same-choice','null-hips'] else ['fedora01'] if name=='preexisting-pin-drift' else outer)
        assert after['pinHolds']==(name!='preexisting-pin-drift')
        assert after['token']==before['token']+(2 if name=='active-pin-two-slots' else 1)
        if name!='postcommit-store-rejection':assert after['writes']==before['writes']+(2 if name=='active-pin-two-slots' else 1)
    if name=='null-torso-and-same-choice':
        same=r['states']['same'];preserve(after,same);assert same['worn']==vestFloor+outer and same['pin'] is None and same['request'] is None and same['resident']==after['resident']==5 and same['token']==3 and len(r['loads'])==5
    if name=='null-hips':assert after['resident']==5 and len(r['loads'])==5
    if name=='active-pin-two-slots':
        assert before['pin']==old and before['request']==old and r['states']['torso']['pin']==vestFloor+outer and r['states']['torso']['request']==outer
        assert r['states']['restored']['worn']==bothFloor+outer and r['states']['restored']['pinHolds'] and len(r['loads'])==6
    if name in ['dormant-pin-own-outers-restart','ask-pending-history']:
        assert before['pin']==oldFloor+['fedora01'] and before['request']==outer and before['history']=={'fedora01':3_000_000} and before['lastChangeAt']==3_000_000 and before['preferences'][0]['honoured'] is True
    if name=='dormant-pin-own-outers-restart':
        restarted=r['states']['restarted'];assert metadata(restarted)==metadata(after) and restarted['worn']==vestFloor+outer
        assert r['states']['woken']['worn']==vestFloor+['fedora01'] and r['states']['restored']['worn']==vestFloor+['fedora01'] and r['states']['restored']['pinHolds'] and r['states']['restored']['mode']=='pinned'
    if name=='preexisting-pin-drift':assert before['pinHolds'] is False and before['pin']==oldFloor+['fedora01'] and after['pin']!=after['worn']
    if name=='ask-pending-history':assert before['mode']=='ask' and before['pending'] is not None and before['pending']['honoured'] is False and before['pending']['outfit']==['fedora01'] and len(before['preferences'])==2 and before['preferences'][1]['honoured'] is False
    if name=='invalid-choice-and-user-mark':assert after==before and 'cannot fill' in r['errors']['invalid'] and len(r['loads'])==4 and r['writeAttempts']==[]
    if name=='precommit-load-failure':
        preserve(before,after)
        for f in ['worn','pin','request','storedDocument','writes']:assert after[f]==before[f]
        assert after['floor']==vestFloor and after['foundationPreference']=={'TORSO':'foundation_vest'} and after['token']==before['token']+1 and after['resident']==4
        assert r['states']['loading']['pendingFragments']==1 and r['states']['loading']['writes']==before['writes']
    if name=='superseded-refresh':
        assert r['states']['loading']['pendingFragments']==1 and r['states']['newerRequested']['token']==before['token']+2
        assert after['pin']==after['worn']==vestFloor+['fedora01'] and after['request']==['fedora01'] and after['writes']==before['writes']+1 and after['token']==before['token']+2
        assert docs[r['writeAttempts'][-1]['document']]['currentRequest']==['fedora01']
    if name=='actualcommit-delivery-held':
        held=r['states']['committedHeld'];new=r['states']['newerApplied'];preserve(before,held)
        assert held['worn']==held['pin']==vestFloor+outer and held['request']==outer and held['writes']==before['writes']+1
        assert new==after and new['pin']==new['worn']==vestFloor+['fedora01'] and new['request']==['fedora01'] and new['writes']==before['writes']+2
        assert r['settlements'][-1]['returnedWorn']==vestFloor+outer and new['worn']!=r['settlements'][-1]['returnedWorn']
    if name=='disposed-refusal':
        preserve(before,after)
        for f in ['worn','pin','request','storedDocument','writes','token']:assert after[f]==before[f]
        assert after['disposed'] and after['worn']==[] and after['floor']==vestFloor and len(r['loads'])==4
    if name=='postcommit-store-rejection':
        assert after['storedDocument']==before['storedDocument'] and after['writes']==before['writes']+1
        assert docs[after['storedDocument']]==metadata(before) and docs[r['writeAttempts'][-1]['document']]==metadata(after) and r['writeAttempts'][-1]['committed'] is False
    counts['cases']+=1;counts['snapshots']+=len(snapshots);counts['settlements']+=len(labels);counts['stored_documents']+=len(docs);counts['write_attempts']+=len(r['writeAttempts'])
    caseRows.append({'name':name,'worn':after['worn'],'pin':after['pin'],'request':after['request'],'mode':after['mode'],'writes':after['writes'],'pending':after['pending'],'settlement_labels':labels})
assert counts['cases']==12 and counts['snapshots']==59 and counts['settlements']==43
warning="Figure: this rig has no jaw, eyeLeft, eyeRight bone(s) (53 bones found). Motion layers that need them must fall back — jaw to the jawOpen morph, gaze to the eyeLook* morphs."
assert (leaf/'STDERR.txt').read_text().splitlines()==[warning]*12
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'decision':'All12 predeclared literal/raw pin/floor/metadata/error/collection cases qualify at CPU scope only.','verified_execution_pins':len(gate['execution_inputs']),'counts':counts,'cases':caseRows,'inputs':[pin(leaf/n) for n in ['ROOT-SOURCE-GATE.json','JOB.json','STDOUT.txt','STDERR.txt','check-raw.py']],'limits':'Controlled real-source CPU/privateMemoryStore/loader/delivery observations; no testbedhelper/DOM/personalstorage/browser/bodycoverage/fit/appearance/performance/AAA; postcommiterror notrollback; no old13replay.'}
with (leaf/'ROOT-OBSERVATION.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result,indent=2))
