"""Plot numeric CPU masks, not screenshots or edited avatar images."""
import json
import hashlib
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
folder=Path(sys.argv[1])
report=json.loads((folder/'report.json').read_text())
w,h=report['grid']['width'],report['grid']['height']
font=ImageFont.load_default(size=14)
canvas=Image.new('RGB',(w*2,(h+56)*len(report['cases'])),(16,18,16))
draw=ImageDraw.Draw(canvas)
for row,case in enumerate(report['cases']):
    for col,surface in enumerate(['high-poly','cornea']):
        item=next(x for x in case['measurements'] if x['surface']==surface and x['mode']=='asset-sidedness')
        data=(folder/item['mask']['file']).read_bytes()
        assert len(data)==w*h and hashlib.sha256(data).hexdigest()==item['mask']['sha256']
        assert all(x in (0,1) for x in data)
        rgb=bytes(v for q in data for v in ((215,230,187) if q else (16,18,16)))
        image=Image.frombytes('RGB',(w,h),rgb).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        x,y=col*w,row*(h+56)
        canvas.paste(image,(x,y+56))
        label='Opaque globe' if surface=='high-poly' else 'Geometric corneal shell'
        draw.text((x+12,y+8),case['id']+' | '+label,fill=(242,239,229),font=font)
        draw.text((x+12,y+29),'CPU rest geometry, 0.1 mm grid; not a native render or continuous closure bound',fill=(183,188,175),font=font)
canvas.save(folder/'mask-overview.png')
print(hashlib.sha256((folder/'mask-overview.png').read_bytes()).hexdigest())
