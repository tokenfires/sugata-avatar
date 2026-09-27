"""Read-only current nose-target support inventory. No geometry authoring or native run.

Usage: python3 <this file> > <fresh receipt.json>
Unit-end measurements describe authored data, not a recommended aesthetic range.
"""
import hashlib,json,struct,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
def sha(b): return hashlib.sha256(b).hexdigest()
pins=[]
def read(p):
 b=(ROOT/p).read_bytes();pins.append({'path':p,'bytes':len(b),'sha256':sha(b)});return b
def obj(b):return json.loads(b)
read(str(Path(__file__).resolve().relative_to(ROOT)))
for p in ['packages/core/src/figure/IdentityTargets.js','packages/core/src/figure/IdentityCatalogue.js','tools/figure-pipeline/build_figure.py','tools/figure-pipeline/hair_cards.py']:
 read(p)
def glb(p):
 b=read(p);assert b[:4]==b'glTF';n=struct.unpack_from('<I',b,12)[0];d=obj(b[20:20+n]);data=b[28+n:]
 widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};types={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
 def access(i):
  a=d['accessors'][i];w=widths[a['type']];fmt=types[a['componentType']];sz=struct.calcsize(fmt);out=[[0]*w for _ in range(a['count'])]
  if 'bufferView' in a:
   v=d['bufferViews'][a['bufferView']];base=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',w*sz)
   for j in range(a['count']):out[j]=list(struct.unpack_from('<'+fmt*w,data,base+j*stride))
  if 'sparse' in a:
   s=a['sparse'];ix=s['indices'];vals=s['values'];itype=types[ix['componentType']];isz=struct.calcsize(itype);ib=d['bufferViews'][ix['bufferView']].get('byteOffset',0)+ix.get('byteOffset',0);vb=d['bufferViews'][vals['bufferView']].get('byteOffset',0)+vals.get('byteOffset',0)
   for j in range(s['count']):
    at=struct.unpack_from('<'+itype,data,ib+j*isz)[0];out[at]=list(struct.unpack_from('<'+fmt*w,data,vb+j*w*sz))
  return out
 m=next(m for m in d['meshes'] if m['name']=='base.001');pr=m['primitives'][0]
 return d,pr,access,{name:access(t['POSITION']) for name,t in zip(m['extras']['targetNames'],pr['targets'])}
d,pr,a,morphs=glb('assets/wardrobe/body/g050.glb');bd,bpr,ba,bm=glb('assets/figures/figure_g050.glb')
positions=a(pr['attributes']['POSITION']);assert positions==ba(bpr['attributes']['POSITION']);assert morphs==bm
mb=read('assets/identity/figure-vertex-map.bin');mapping=list(struct.unpack('<'+'H'*(len(mb)//2),mb));assert len(mapping)==len(positions)==14517
by_source={}
for i,s in enumerate(mapping):by_source.setdefault(s,[]).append(i)
assert len(by_source)==13380
for ix in by_source.values():assert all(positions[i]==positions[ix[0]] for i in ix)
catalogue=obj(read('assets/identity/catalogue.json'));packed=read('assets/identity/targets/nose.bin')
archive_members={};sources={}
for name in ['mpfb-2.0.17.zip','makehuman_system_assets_cc0.zip']:
 p='tools/figure-pipeline/.cache/'+name;b=read(p)
 with zipfile.ZipFile(ROOT/p) as z:
  if name.startswith('mpfb'):
   wanted=['data/mesh_metadata/basemesh_vertex_groups.json']
  else:
   wanted=['eyes/high-poly/high-poly.mhclo','teeth/teeth_base/teeth_base.mhclo','tongue/tongue01/tongue01.mhclo','eyebrows/eyebrow001/eyebrow001.mhclo','eyelashes/eyelashes01/eyelashes01.mhclo','clothes/female_casualsuit01/female_casualsuit01.mhclo','clothes/female_elegantsuit01/female_elegantsuit01.mhclo','clothes/shoes01/shoes01.mhclo']
  for member in wanted:
   value=z.read(member);sources[member]=value;archive_members[member]={'archive':p,'bytes':len(value),'sha256':sha(value)}
groups={k:{i for lo,hi in v for i in range(lo,hi+1)} for k,v in obj(sources['data/mesh_metadata/basemesh_vertex_groups.json']).items()}
def dependencies(text):
 refs=set();scale=set();verts=False;rows=0
 for line in text.decode().splitlines():
  w=line.split()
  if not w or w[0].startswith('#'):continue
  if w[0] in ['x_scale','y_scale','z_scale']:scale.update(map(int,w[1:3]))
  if w[0]=='verts':assert w==['verts','0'];verts=True;continue
  if verts:
   if w[0]=='delete_verts':break
   assert len(w) in [1,9] and w[0].isdigit(),w
   refs.update(map(int,w[:1 if len(w)==1 else 3]));rows+=1
 return {'references':refs,'scaleReferences':scale,'rows':rows}
deps={k:dependencies(v) for k,v in sources.items() if k.endswith('.mhclo')}
body_skin=d['skins'][next(n['skin'] for n in d['nodes'] if n.get('mesh')==next(i for i,m in enumerate(d['meshes']) if m['name']=='base.001'))]
names=[d['nodes'][n]['name'] for n in body_skin['joints']];ji=a(pr['attributes']['JOINTS_0']);jw=a(pr['attributes']['WEIGHTS_0'])
results=[]
for slider in catalogue['sliders']:
 if slider['region']!='nose':continue
 for end,e in slider['ends'].items():
  records=[struct.unpack_from('<Ifff',packed,e['offset']+16*i) for i in range(e['count'])];assert len({r[0] for r in records})==len(records)
  moved={r[0] for r in records if any(r[1:])};ids=sorted(i for s in moved for i in by_source.get(s,[]));supported={k:sum(any(vs[i]) for i in ids) for k,vs in morphs.items()}
  weights={};
  for i in ids:
   for j,w in zip(ji[i],jw[i]):
    if w:weights[names[j]]=max(weights.get(names[j],0),w)
  dependency={k:{'references':sorted(moved&v['references']),'scaleReferences':sorted(moved&v['scaleReferences'])} for k,v in deps.items()}
  results.append({'slider':slider['id'],'end':end,'target':e['target'],'rawRecords':len(records),'movedSourceIDs':sorted(moved),'mappedPositionIDs':ids,'unmappedSourceIDs':sorted(moved-set(by_source)),'unitMaxDisplacementMM':max(sum(x*x for x in r[1:])**.5 for r in records)*100,'currentSupportBoundsM':{'min':[min(positions[i][c] for i in ids) for c in range(3)],'max':[max(positions[i][c] for i in ids) for c in range(3)]},'jointOrHelperGroups':{k:sorted(moved&v) for k,v in groups.items() if (k.startswith(('joint-','helper-')) or k in ['JointCubes','HelperGeometry']) and moved&v},'nativeSkinMaxPositiveWeights':weights,'sourceFitDependencyIntersections':dependency,'nonzeroMorphSupportIntersections':{k:v for k,v in supported.items() if v}})
report={'kind':'read-only-nose-support-inventory','sourceHashes':pins,'archiveMembers':archive_members,'bodyBarePositionsAndAllMorphsExact':True,'positions':len(positions),'morphs':len(morphs),'sourceMapSplitPositionsExact':True,'targets':results,'proxyDependencyCounts':{k:{'rows':v['rows'],'referenceCount':len(v['references']),'scaleReferences':sorted(v['scaleReferences'])} for k,v in deps.items()},'limits':['No aesthetic parameter/range selected. Unit values measure authored source ends only.','Morph-support intersection is not anatomical margin membership or proof of closure failure.','Zero source-fit dependency and scale intersections imply unchanged inputs to the source fitter; no new native MPFB comparison or proxy refit is claimed.','Joint-helper support is reported exactly; current skeleton matrices are not recalculated.','Nose-bone support and helper-hair exclusion do not yet establish complete groom attachment/clearance; scalp source group is not in this retained group table.','No geometry/material/asset modification, controller, GPU/native render or product qualification.']}
print(json.dumps(report,indent=2,allow_nan=False))
