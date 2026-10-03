from pathlib import Path
import hashlib,json,difflib,datetime,os,sys
p=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
r=json.loads((p/'PREPARE-RECEIPT.json').read_text())
h=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert all(h(k)==v for k,v in r['inputPins'].items())
assert all(h(k)==v for k,v in r['outputHashes'].items())
old=Path('docs/evidence/nonhair-2026-10-03/whole-head-volume')
for name in ['build.mjs','preview.mjs','preview.html','world-gate-worker.mjs','observer.mjs']:
 a=Path('tools/critic/whole-head-volume.mjs') if name=='observer.mjs' else old/name
 b=Path('tools/critic/fixed-fan-volume.mjs') if name=='observer.mjs' else p/name
 expected=''.join(difflib.unified_diff(a.read_text().splitlines(True),b.read_text().splitlines(True),fromfile=str(a),tofile=str(b)))
 assert (p/(name+'.diff')).read_text()==expected,name
names=[str(p/n) for n in ['PLAN.md','CRITIC-VALUE.md','prepare.py','PREPARE-RECEIPT.json','build.mjs','preview.mjs','preview.html','world-gate-worker.mjs','build.mjs.diff','preview.mjs.diff','preview.html.diff','world-gate-worker.mjs.diff','observer.mjs.diff']]+['tools/critic/fixed-fan-volume.mjs','docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json','docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json','tools/figure-pipeline/hair_surface.mjs','packages/core/src/motion/HairSkinTransform.js']
receipt={'pid':os.getpid(),'observed':datetime.datetime.now(datetime.timezone.utc).isoformat(),'interpreter':sys.executable,'pythonVersion':sys.version,'scope':'Static file/hash/diff readback only; no evaluator, geometry, imported project code, browser or GPU.','allPrepareInputsUnchanged':True,'allPrepareOutputsExact':True,'allFiveDiffsExact':True,'pins':{n:h(n) for n in names}}
with (p/'CRITIC-SOURCE-READBACK.json').open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
print(json.dumps(receipt,indent=2))
