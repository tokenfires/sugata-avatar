from pathlib import Path
import hashlib,json,datetime,os,sys,collections
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
out=Path('captures/fixed-fan-volume-2026-10-03-v1')
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
h=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
r=json.loads((out/'report.json').read_text())
assert h(out/'report.json')=='8c37282c8fbb5c629d6bc28989685abeaa0e9c78784ef3cac9ed33cf0cbda083'
assert r['pid']==54219 and r['status']=='failed' and r['images']==[] and r['failedResources']==[]
assert r['cleanup']=={'worldWorker':'not-created','page':'closed','browser':'closed'}
assert len(r['errors'])==2 and 'fixed-fan-volume.mjs:27:100' in r['errors'][0] and 'fixed-fan-volume.mjs:50:613' in r['errors'][1]
assert 'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:' in r['errors'][0]
assert "'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:" in r['errors'][1]
assert len(r['warnings'])==4 and len(set(r['warnings']))==3
assert all(h(k)==v for k,v in r['sources'].items())
assert all(h(k)==v for k,v in r['inputs'].items())
assert h('tools/critic/fixed-fan-volume.mjs')==h(out/'instrument.mjs')==r['instrumentSHA256']
ret=r['retirement'];assert ret['restored']=={'originalVisible':True,'expected':True,'proposalVisible':False}
assert ret['errors']==[] and ret['disposal']=={'disposed':True,'leaked':[]}
assert sorted(event['name'] for event in ret['ownedDisposals'])==['geometry','material']
assert all(event['uuid']==ret[event['name']] for event in ret['ownedDisposals'])
assert set(f.name for f in out.iterdir())=={'report.json','instrument.mjs'}
assert all(k not in r for k in ['worldSHA256','worldGateSHA256','worldGate','finalPinsUnchanged'])
fixture=(p/'preview.mjs').read_text();instrument=Path('tools/critic/fixed-fan-volume.mjs').read_text()
wardrobe=Path('packages/core/src/wardrobe/Wardrobe.js').read_text()
assert 'body:{positions:bodyPositions,indices:Array.from(body.geometry.index.array)' in fixture
assert 'assert.deepEqual(world.body.indices,Array.from(bodySource.indices))' in instrument
assert instrument.index('assert.deepEqual(world.body.indices')<instrument.index("fs.writeFileSync(out+'/world.json'")<instrument.index('worldWorker=new Worker')
assert 'this.fullIndex = index.array.slice();' in wardrobe
assert 'target[ written ] = a;' in wardrobe and 'geometry.setDrawRange( 0, written );' in wardrobe
assert 'this.#rebuildBodyIndex( this.manifest.hideMasksFor( outfit ) );' in wardrobe
pins={**r['sources'],**r['inputs'],str(out/'report.json'):h(out/'report.json'),str(out/'instrument.mjs'):h(out/'instrument.mjs'),str(p/'critic-native-refusal-readback.py'):h(__file__)}
receipt={'pid':os.getpid(),'command':'python3 '+str(p/'critic-native-refusal-readback.py'),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'sourceSHA256':h(__file__),'status':'independent native-refusal/source readback passed','nativeStarted':r['started'],'nativeFinished':r['finished'],'recordedSourcePins':len(r['sources']),'recordedInputPins':len(r['inputs']),'allCurrentRecordedPinsExact':True,'errorSummary':[{'sha256':hashlib.sha256(e.encode()).hexdigest(),'characters':len(e),'stackWitness':'fixed-fan-volume.mjs:27:100' if i==0 else 'fixed-fan-volume.mjs:50:613'} for i,e in enumerate(r['errors'])],'firstFailure':'live body geometry index compared with unmasked source index','secondError':'final empty-error-array assertion repeats first failure, not an independent resource failure','nativeImages':0,'worldDataSaved':False,'worldWorkerCreated':False,'proposalAdmitted':False,'retirement':ret,'cleanup':r['cleanup'],'warningTypes':dict(collections.Counter(r['warnings'])),'pins':pins,'limits':['No Avatar/browser/GPU/evaluator/geometry/worker execution by critic.','No retained full world snapshot: source explains mismatch but exact runtime mask/array identity cannot be independently reconstructed from omitted data.','Native finalPinsUnchanged flag absent; current independent rehash is separate evidence.','No appearance, actual-world crossing, containment, clearance, motion or AAA judgment.']}
with (p/'CRITIC-NATIVE-READBACK.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['pins','warningTypes']},indent=2))
