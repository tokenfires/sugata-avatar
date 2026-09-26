# Read only repository/cache inputs; write a fresh compact provenance receipt beside this script.
from pathlib import Path
import zipfile, hashlib, json
here=Path(__file__).resolve().parent
root=here.parents[4]
archive=root/'tools/figure-pipeline/.cache/makehuman_system_assets_cc0.zip'
h=lambda b:hashlib.sha256(b).hexdigest()
items=[]
with zipfile.ZipFile(archive) as z:
 for role,directory,image_name in [('current','young_caucasian_female','young_lightskinned_female_diffuse.png'),('alternate','young_caucasian_female2','young_lightskinned_female_diffuse2.png')]:
  png_name=f'skins/{directory}/{image_name}'
  mhmat_name=f'skins/{directory}/{directory}.mhmat'
  png=z.read(png_name);mhmat=z.read(mhmat_name)
  extracted=root/'captures/skin-albedo-inventory-2026-09-26'/image_name
  assert extracted.read_bytes()==png
  text=mhmat.decode();assert 'explicitly released as CC0 in september 2020' in text
  assert f'diffuseTexture {image_name}' in text
  items.append({'role':role,'zipPNG':png_name,'pngSHA256':h(png),'pngBytes':len(png),'extractedPath':str(extracted),'extractedByteIdentical':True,'zipMhmat':mhmat_name,'mhmatSHA256':h(mhmat),'mhmatBytes':len(mhmat),'mhmatText':text,'scope':'Stored source header and exact texture pointer; no material/shader settings applied or licence interpretation beyond the retained text.'})
assert items[0]['pngSHA256']=='b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc'
assert items[1]['pngSHA256']=='8d1fb3ceedf142fad32a3504eca1feb4539aecca6de66acde1514b9a61fc7ba0'
report={'archive':str(archive),'archiveSHA256':h(archive.read_bytes()),'archiveBytes':archive.stat().st_size,'scriptSHA256':h(Path(__file__).read_bytes()),'items':items}
p=here/'inventory-v1.json';p.open('x').write(json.dumps(report,indent=2)+'\n')
print(json.dumps({'path':str(p),'sha256':h(p.read_bytes()),'items':[{k:v for k,v in i.items() if k!='mhmatText'} for i in items]},indent=2))
