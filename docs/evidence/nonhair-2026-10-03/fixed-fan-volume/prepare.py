"""Author isolated source only from pinned prior instrument; no geometry evaluation."""
from pathlib import Path
import hashlib,json,datetime,os,difflib
old=Path('docs/evidence/nonhair-2026-10-03/whole-head-volume')
new=Path('docs/evidence/nonhair-2026-10-03/fixed-fan-volume')
sha=lambda b:hashlib.sha256(b).hexdigest()
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
pins={str(old/'build.mjs'):'37467d6a8748d3315b6907ae2e75695b114506db4974bb9c9f4b73f325434a03',str(old/'preview.mjs'):'0dbfeb37057550ea63a1938d39d94f20e65beab3f43b7eb6fb5dd3505774bea5',str(old/'preview.html'):'68aed52a40e93530bb77ac8b2652d6c3b4dcba729e48c84f0e6b46989135f82c',str(old/'world-gate-worker.mjs'):'da5f370d0d21902c19246740452c71a1dcd9241b527a6042fbe9f20dd0c570d3','tools/critic/whole-head-volume.mjs':'9cc05e38b70cf7c03fd4ac15d975ecb38c0a5ce97b212905c35a1ed1d5455c77',str(new/'PLAN.md'):'aedd1c9973b4c13a708f723f917be631f53f097a185dbdd1295607bbbe02cd02',str(new/'CRITIC-VALUE.md'):'9d5718ec06db784f906e6c690f9a769a9a8f204f56375089af9ef236990625db'}
for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
outputs={}
for name in ['build.mjs','preview.mjs','preview.html','world-gate-worker.mjs','observer.mjs']:
 source=Path('tools/critic/whole-head-volume.mjs')if name=='observer.mjs'else old/name
 destination=Path('tools/critic/fixed-fan-volume.mjs')if name=='observer.mjs'else new/name
 assert not destination.exists(),str(destination)
 original=source.read_text()
 text=original.replace('whole-head-volume','fixed-fan-volume').replace('wholeHeadVolume','fixedFanVolume').replace('Whole-head volume','Fixed-fan volume').replace('whole-head gray','fixed-fan gray')
 for a,b in [('18:41:00','19:41:00'),('18:42:00','19:43:00'),('18:44:00','19:44:00'),('18:49:00','19:49:00'),('18:55:00','19:55:00')]:text=text.replace(a,b)
 if name=='build.mjs':
  text=text.replace("const input='docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json';","const input='docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json';\nconst topologyPath='docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json';")
  text=text.replace("const pins={[input]:","const pins={[topologyPath]:'c057cc38b0e6cca4eb6d1d955f31b4b5263daf01260bfb65a21c218e93b4eeeb',[input]:")
  text=text.replace("const net=JSON.parse(fs.readFileSync(input)),N=10,EPS=1e-9,positions=[],indices=[],keys=[],cache=new Map(),edgeCache={},patchRows=[];","const net=JSON.parse(fs.readFileSync(input)),topology=JSON.parse(fs.readFileSync(topologyPath)),N=10,EPS=1e-9,keys=topology.vertices.map(v=>v.key),edgeCache=topology.canonicalEdgeCache,patchRows=topology.patches;\nconst patches=new Map(Object.values(net.panels).flatMap(panel=>panel.patches).map(q=>[q.id,q]));\nlet P,I;")
  lo=text.index('const add=');hi=text.index('const curve=',lo);text=text[:lo]+text[hi:]
  lo=text.index('for(const[id,e]of Object.entries(net.edges))');hi=text.index('const sample=',lo);text=text[:lo]+text[hi:]
  lo=text.index('for(const panel of Object.values(net.panels))');hi=text.index('const sub=',lo)
  text=text[:lo]+"const point=i=>Array.from(P.slice(i*3,i*3+3));\n"+text[hi:]
  oldcheck=" check('fixed complete cache/grid size',P.length/3===4091&&I.length/3===8000,{vertices:P.length/3,triangles:I.length/3,nodes:Object.keys(net.nodes).length,curves:Object.keys(edgeCache).length,patches:patchRows.length});"
  replacement=""" check('exact symbolic source instance',topology.sourceInterface.path===input&&topology.sourceInterface.sha256===pins[input]&&topology.N===N&&topology.vertices.length===8091&&topology.faces.length===16000);
 const positions=[];report.evaluations={canonicalNode:0,canonicalCurve:0,CoonsPatch:0,CoonsCellCentre:0};
 for(let id=0;id<topology.vertices.length;id++){
  limit();const record=topology.vertices[id],e=record.evaluation;let value;
  if(e.kind==='canonicalNode')value=net.nodes[e.node];
  else if(e.kind==='canonicalCurve')value=curve(net.edges[e.edge],e.t[0]/e.t[1]);
  else if(e.kind==='CoonsPatch'||e.kind==='CoonsCellCentre')value=surface(patches.get(e.patch),e.u[0]/e.u[1],e.v[0]/e.v[1]);
  else throw Error('Unknown symbolic evaluator: '+e.kind);
  check('finite Float64 evaluation '+id,value?.length===3&&value.every(Number.isFinite),{id,key:record.key,evaluation:e,value});
  positions.push(...value);report.evaluations[e.kind]++;
 }
 P=new Float32Array(positions);I=new Uint32Array(topology.faces.flat());
 check('fixed exact cache/grid/centre size',P.length/3===8091&&I.length/3===16000&&keys.length===8091,{vertices:P.length/3,triangles:I.length/3,nodes:Object.keys(net.nodes).length,curves:Object.keys(edgeCache).length,patches:patchRows.length,centres:report.evaluations.CoonsCellCentre});
 check('exact declared integer faces',topology.faces.every(f=>f.length===3&&f.every(Number.isInteger))&&topology.faces.every((f,t)=>f.every((v,k)=>v===I[t*3+k])));
"""
  assert oldcheck in text;text=text.replace(oldcheck,replacement)
  text=text.replace("a>1e-12,{triangle:t/3,doubleArea:a}","a>1e-12,{triangle:t/3,ids,keys:ids.map(i=>keys[i]),vertices:v,doubleArea:a}")
  text=text.replace("geometry.computeVertexNormals();const normals=geometry.attributes.normal.array;","geometry.computeVertexNormals();const normals=geometry.attributes.normal.array;")
  text=text.replace(".every(n=>n>0)",".every(n=>Math.abs(n-1)<1e-5)")
  text=text.replace("interfaceSHA256:pins[input],buffers:","interfaceSHA256:pins[input],topologySHA256:pins[topologyPath],pointDefinitions:topology.vertices,buffers:")
  text=text.replace("vertices:P.length/3,triangles:I.length/3,reportSHA256:","vertices:P?.length/3||0,triangles:I?.length/3||0,reportSHA256:")
 if name=='preview.mjs':
  text=text.replace("&&metadata.subdivisions===10,","&&metadata.topologySHA256==='c057cc38b0e6cca4eb6d1d955f31b4b5263daf01260bfb65a21c218e93b4eeeb'&&metadata.vertices===8091&&metadata.triangles===16000&&metadata.subdivisions===10,")
 if name=='observer.mjs':
  needle="for(const p of ['looks/sage-lavender-chin.json'"
  text=text.replace(needle,"for(const p of ['docs/evidence/nonhair-2026-10-03/cell-fan-contract/topology.json','docs/evidence/nonhair-2026-10-03/shared-boundary-interface/interface.json','looks/sage-lavender-chin.json'")
 destination.write_text(text)
 diff=''.join(difflib.unified_diff(original.splitlines(True),text.splitlines(True),fromfile=str(source),tofile=str(destination)))
 (new/(name+'.diff')).write_text(diff)
 outputs[str(destination)]=sha(destination.read_bytes())
for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
r={'pid':os.getpid(),'command':'python3 '+str(new/'prepare.py'),'started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputPins':pins,'outputHashes':outputs,'status':'isolated source authored only; no geometry/evaluator/native execution','changes':['Renamed packet/global/instrument/capture paths and fixed times; unchanged world-worker duties.','Consume exact frozen point definitions and faces, once-evaluated rational node/curve/Coons/grid/centre positions; unchanged artist/interface.','Require exact topology/counts/faces and normalized finite area-weighted normals; enrich area-refusal witness.','Native metadata checks exact topology and counts; observer pins both symbolic topology and interface.','No accepted source/assets/old frozen instrument edited.']}
(new/'PREPARE-RECEIPT.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r))
