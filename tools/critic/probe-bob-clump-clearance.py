"""Two-card source-stage ablation. Final production vertex clearance remains enabled."""
from pathlib import Path
import sys, json, runpy, hashlib, datetime, os
import bpy
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'captures/bob-clump-clearance-v1'
assert not (OUT/'build-report.json').exists()
args=sys.argv[sys.argv.index('--')+1:]
def opt(key):
 assert args.count(key)==1,key
 return args[args.index(key)+1]
assert opt('--hair')=='bob02' and float(opt('--gender'))==.5
for key in ['--output','--hair-dir']: assert Path(opt(key)).resolve().is_relative_to(OUT)
assert '--no-hair-collision' not in args and '--no-hair-cap' not in args
assert Path(bpy.utils.user_resource('CONFIG')).is_relative_to(ROOT/'tmp/hair-sep29/blender-profile')
OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools/figure-pipeline'))
import hair_cards as hc
selected={322,449};counter=0;original=hc.draw_into_lock
paths=['tools/critic/probe-bob-clump-clearance.py','tools/figure-pipeline/hair_cards.py','tools/figure-pipeline/build_figure.py']
def hashes():return{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
report={'status':'running','pid':os.getpid(),'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':hashes(),'cards':sorted(selected),'arguments':args,'intervention':'Only selected draws receive body=None, retaining original blend and RNG. Original final per-vertex clamp remains enabled.','limits':['Source-stage diagnostic, not a qualified asset. Transplant only selected card outputs onto accepted baseline after correspondence checks.']}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
for p in paths:
 dest=OUT/'source'/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((ROOT/p).read_bytes())
def draw(guide,lock_guide,tightness,body,standoff):
 global counter
 card=counter;counter+=1
 return original(guide,lock_guide,tightness,None if card in selected else body,standoff)
hc.draw_into_lock=draw
try:
 runpy.run_path(str(ROOT/'tools/figure-pipeline/build_figure.py'),run_name='__main__')
 assert counter==496 and hashes()==report['sources']
 report['status']='built-awaiting-isolation-and-render'
except BaseException as e:
 report['status']='failed';report['error']=repr(e);raise
finally:
 report['drawCount']=counter;report['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
 print('CLUMP_PROBE='+json.dumps(report))
