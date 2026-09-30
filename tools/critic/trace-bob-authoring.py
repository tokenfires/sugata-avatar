"""Observe one original generator run into captures/. Never writes accepted assets.

Run with the isolated Blender wrapper and explicit --output and --hair-dir paths.
The exported original fixture must be compared before interpreting stage attribution.
"""
from pathlib import Path
import sys, json, hashlib, gzip, runpy, datetime
import bpy

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'captures/bob-authoring-trace-v1'
assert not (OUT/'trace.json.gz').exists(), 'Preserve prior trace evidence'
OUT.mkdir(parents=True, exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:]
def option(key):
    assert args.count(key)==1, key
    return args[args.index(key)+1]
assert option('--hair')=='bob02' and float(option('--gender'))==.5
assert Path(option('--output')).resolve().is_relative_to(OUT)
assert Path(option('--hair-dir')).resolve().is_relative_to(OUT)
assert '--no-hair-collision' not in args and '--no-hair-cap' not in args
assert Path(bpy.utils.user_resource('CONFIG')).is_relative_to(ROOT/'tmp/hair-sep29/blender-profile')
PIPELINE=ROOT/'tools/figure-pipeline'
sys.path.insert(0,str(PIPELINE))
import hair_cards as hc

def vectors(values): return [[float(x) for x in p] for p in values]
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
source_paths=['tools/critic/trace-bob-authoring.py','tools/figure-pipeline/build_figure.py',
              'tools/figure-pipeline/hair_cards.py','tools/figure-pipeline/hair_texture.py',
              'tools/figure-pipeline/mpfb_bridge.py','tools/figure-pipeline/fixtures/bob02-g050-original.glb']
def hashes(): return {p:sha(ROOT/p) for p in source_paths}
trace={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'running',
       'blender':bpy.app.version_string,'blenderBuildHash':bpy.app.build_hash.decode(),
       'arguments':args,'sources':hashes(),'cards':[],'layers':[],'errors':[],
       'limits':['Observer wrappers retain random streams and production functions. Correspondence with the preserved original is not assumed.',
                 'Intermediate Blender-local coordinates need their recorded object matrix and axis conversion before comparison with exported GLB.']}
for relative in source_paths:
    if not relative.endswith('.glb'):
        dest=OUT/'source'/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((ROOT/relative).read_bytes())
state={'layer':None,'pending':None}
original_grow_layer=hc.grow_layer
def grow_layer(basemesh,frame,body,layer,locks,edge_scale,arguments):
    state['layer']=layer['name'];start=len(trace['cards'])
    result=original_grow_layer(basemesh,frame,body,layer,locks,edge_scale,arguments)
    trace['layers'].append({'name':layer['name'],'start':start,'end':len(trace['cards']),'parameters':layer})
    return result
hc.grow_layer=grow_layer

original_draw=hc.draw_into_lock
def draw(guide,lock_guide,tightness,body,standoff):
    before=vectors(guide)
    # Pure observer reconstruction of the blend before clearance; no RNG or source mutation.
    raw=[p.lerp(lock_guide[i],tightness*(i/(len(guide)-1))**hc.CLUMP_POWER) for i,p in enumerate(guide)] if tightness>0 else guide
    after=original_draw(guide,lock_guide,tightness,body,standoff)
    state['pending']={'grownToCut':before,'lockGuide':vectors(lock_guide),'blendedBeforeClearance':vectors(raw),
                      'clumpedAfterClearance':vectors(after),'tightness':tightness,'standoff':standoff}
    return after
hc.draw_into_lock=draw

original_ribbon=hc.ribbon_of
def ribbon(guide,frame,layer,strip,random,lock):
    result=original_ribbon(guide,frame,layer,strip,random,lock)
    assert state['pending'] is not None
    record=state['pending'];state['pending']=None
    record.update({'card':len(trace['cards']),'layer':layer['name'],'strip':strip,'lock':lock,
                   'ribbonRings':[{'left':list(a),'right':list(b),'s':s} for a,b,s in result['rings']]})
    trace['cards'].append(record)
    return result
hc.ribbon_of=ribbon

original_clamp=hc.clamp_cards_off_the_body
def clamp(obj,body,frame,collide=True):
    before=vectors(v.co for v in obj.data.vertices)
    result=original_clamp(obj,body,frame,collide)
    trace['clamp']={'before':before,'after':vectors(v.co for v in obj.data.vertices),
                    'objectMatrix':[list(row) for row in obj.matrix_world],
                    'cardVertexBase':len(before)-len(trace['cards'])*34,
                    'headCentre':list(frame.head_centre),'hairlineZ':frame.hairline_z,
                    'verticesMovedCount':result[0],'verticesRescuedCount':result[1],
                    'closestAfterMetres':result[2],'closestAfterAt':list(result[3])}
    return result
hc.clamp_cards_off_the_body=clamp

try:
    runpy.run_path(str(PIPELINE/'build_figure.py'),run_name='__main__')
    assert hashes()==trace['sources'], 'Source bytes changed during trace'
    assert len(trace['cards'])==496, len(trace['cards'])
    trace['status']='built-awaiting-fixture-correspondence'
except BaseException as error:
    trace['status']='failed';trace['errors'].append(repr(error));raise
finally:
    trace['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    (OUT/'trace.json.gz').write_bytes(gzip.compress(json.dumps(trace).encode()))
    (OUT/'summary.json').write_text(json.dumps({k:v for k,v in trace.items() if k not in ['cards','clamp']},indent=2)+'\n')
    print('AUTHORING_TRACE='+json.dumps({'status':trace['status'],'cards':len(trace['cards']),'output':str(OUT),'errors':trace['errors']}))
