import datetime, hashlib, json, os, pathlib
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
repo=pathlib.Path('/Users/robault/GitHub/sugata-avatar'); folder=pathlib.Path(__file__).resolve().parent
def sha(data):return hashlib.sha256(data).hexdigest()
expected={'CRITIC-WORTH.md':'7573554bf8434c34fbd13efa995189888ff6144d8760dc8861c621babb699b85','CRITIC-RESULT.md':'cb10eed8e149913cf507b0f16aaedf447689946f9b3ae787d8c98677f2e475db','CRITIC-RECEIPT-READ.py.source':'fd872a43bde62c7d34de9b0b1e710701d1117a72fecc5330ef482ee7b0989ceb','OWNERSHIP.json':'1e611a61b9c1ebb4d7ff2d52234243bae6e74f439f39e632a2fd7343e181c727'}
for file,digest in expected.items(): assert sha((folder/file).read_bytes())==digest,file
r=json.loads((folder/'OWNERSHIP.json').read_text())
assert sha((folder/'read-ownership.mjs').read_bytes())==r['readerSha256']
for row in r['pins']:
 data=(repo/row['file']).read_bytes(); assert len(data)==row['bytes'] and sha(data)==row['sha256'],row['file']
summary=[]
for garment in r['garments']:
 for mesh in garment['meshes']:
  combined=[]; partitions={}
  for label,part in mesh['regions'].items():
   ids=part['sourceTriangleOrdinals']; assert len(ids)==part['triangleCount'] and ids==sorted(set(ids))
   assert sha(json.dumps(ids,separators=(',',':')).encode())==part['ordinalJsonSha256']
   combined+=ids; partitions[label]=dict(triangles=len(ids),first=ids[0],last=ids[-1])
  assert sorted(combined)==list(range(mesh['sourceTriangleCount']))
  assert mesh['mixedTriangleCount']==0 and mesh['mixedTriangles']==[]
  assert sum(c['vertices'] for c in mesh['indexedComponents'])==mesh['usedVertexCount']==mesh['sourceVertexCount']
  assert all(len(c['labels'])==1 for c in mesh['indexedComponents'])
  assert all(a['count']==mesh['sourceVertexCount'] for a in mesh['attributes'].values())
  assert mesh['underMaskAttributes']==[] and mesh['exactPositionAliases']['crossRegionGroups']==0
  summary.append(dict(id=garment['id'],partitions=partitions,vertices=mesh['sourceVertexCount'],triangles=mesh['sourceTriangleCount'],indexedComponents=len(mesh['indexedComponents'])))
body_masks=[m for primitive in r['bodyMasks'] for m in primitive['masks']]
assert {m['name'] for m in body_masks}=={'_HIDE_FEMALE_CASUALSUIT01','_HIDE_FEMALE_ELEGANTSUIT01','_HIDE_SHOES01'}
assert all(m['count']==14517 for m in body_masks)
primary=json.loads((folder/'PRIMARY-GLTF.json').read_text())
d=primary.get('structuredContent') or json.loads(primary['content'][0]['text'])
assert d['metadata']['sourceURL']=='https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html' and d['metadata']['statusCode']==200
output=dict(command='python3 docs/evidence/nonhair-2026-10-03/separates-feasibility/root-verify.py',pid=os.getpid(),started=started,ended=datetime.datetime.now(datetime.timezone.utc).isoformat(),readerSha256=sha(pathlib.Path(__file__).read_bytes()),expected=expected,pins=r['pins'],summary=summary,bodyMasks=body_masks,primary=dict(metadata=d['metadata'],responseSha256=sha((folder/'PRIMARY-GLTF.json').read_bytes()),documentSha256=sha(d['markdown'].encode())),decision='Retain exact geometry triangle lead; defer complete separates construction. No new outfit/appearance/fit qualification.',scope='Independent complete critic/source/receipt-data review, all8428ordinal checks and exact pins; no GLB parse, helper rerun or construction')
with (folder/'ROOT-VERIFIED.json').open('x') as h:json.dump(output,h,indent=2);h.write('\n')
print(json.dumps({k:output[k] for k in ['pid','started','ended','readerSha256','summary','decision']}))
