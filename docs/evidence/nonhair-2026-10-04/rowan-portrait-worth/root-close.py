import datetime, hashlib, json, os
from pathlib import Path
p=Path(__file__).resolve().parent; repo=p.parents[3]
started=datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime.fromisoformat('2026-10-04T06:15:00+00:00')
sha=lambda b:hashlib.sha256(b).hexdigest()
paths=['packages/core/src/Avatar.js','packages/core/src/figure/Identity.js','packages/core/src/material/HairColourOptions.js','packages/testbed/src/portrait.js','packages/testbed/src/portrait-selection.mjs','docs/API.md','docs/evidence/nonhair-2026-10-03/body-breadth-worth/WORTH.md','docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png','assets/figures/figure_g100.glb','assets/hair/bob01/g100.glb','assets/hair/bob01/albedo.png','assets/hair/bob01/normal.png','assets/hair/bob01/flow.png','assets/hair/bob01/depth.png']
rows=[]
for name in paths:
 b=(repo/name).read_bytes();rows.append({'path':name,'bytes':len(b),'sha256':sha(b)})
packet=[]
for f in sorted(p.iterdir()):
 assert f.is_file()
 b=f.read_bytes();packet.append({'file':f.name,'bytes':len(b),'sha256':sha(b)})
assert (p/'CRITIC-VALUE.md').is_file()
assert (p/'SOURCE-CORRECTION.md').is_file()
expected={'packages/core/src/figure/Identity.js':'302836c5bef94c83c39360619821af25abeec83f270087f107752ad7ccd9acff','packages/core/src/Avatar.js':'fdbe49aec99f9c718bde269b5e434cda07af1504ea8df386a634714cea112b18','packages/core/src/material/HairColourOptions.js':'900685719e611bcb8056d35c8f9ad68d6dc8e263bc5a93abea2cab391d820409','PLAN.md':'12cc36127a776cc82b5626b2df42d4196a98bea81f066a1a3d29da79aeaea026','ARTIST-DECISION.md':'00ae6737fad4932ce508e35e643aa51baa687bd4e152b1faf21cd9880114c47b','SOURCE-CORRECTION.md':'018a8bb431afc01baabed946f41821066474bea135981e45c86447d62f424363','official-face-framing.jpg':'b635a8e0d9dd3e77394ea3e2583f7230f7c5e700b32e397c4558241877ba1813','docs/evidence/nonhair-2026-10-03/ink-denim-look/archive/capture/neutral-portrait.png':'bf331b7f391c194e41597f78e7a10438b2371cbf4cc2f3b9b2f493050c094644','CRITIC-VALUE.md':'d944ee0e3518e64709e5d09ab65226791cc9dc350f023a8dd17bea8e50d42aa9'}
for name, value in expected.items():
 base=repo if '/' in name else p
 assert sha((base/name).read_bytes()) == value, name
ended=datetime.datetime.now(datetime.timezone.utc)
assert ended < datetime.datetime.fromisoformat('2026-10-04T06:15:00+00:00')
r={'command':'python3 docs/evidence/nonhair-2026-10-04/rowan-portrait-worth/root-close.py','pid':os.getpid(),'started':started.isoformat(),'ended':ended.isoformat(),'externalPins':rows,'packetPins':packet,'criticBindingsIndependentlyChecked':len(expected),'decision':'Conditional A for exact g100 unchanged bob01 artistic portrait screening; no native/adoption admitted here','scope':'Root independently reads complete critic and actual current source, actually sees final on-page photo and accepted portrait; hashes only, no asset parse/runtime/import/geometry calculation.'}
with (p/'ROOT-CLOSE.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
print(json.dumps({'pid':r['pid'],'started':r['started'],'ended':r['ended'],'externalPins':len(rows),'packetPins':len(packet),'metadataSHA256':sha((p/'ROOT-CLOSE.json').read_bytes())}))
