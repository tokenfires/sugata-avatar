"""Rebuild unchanged crop geometry and hash each card's final positions with its source layer."""
import hashlib, json, os, runpy, struct, sys
from pathlib import Path
pipeline=Path.cwd()/'tools/figure-pipeline'
sys.path.insert(0,str(pipeline))
import hair_cards as h
original_assemble=h.assemble_cards
original_clamp=h.clamp_cards_off_the_body
context={}

def assemble(basemesh,cards,shells,style,locks,edge_scale):
    context.update(cards=cards,capVertices=sum(len(s['points']) for s in shells),style=style)
    return original_assemble(basemesh,cards,shells,style,locks,edge_scale)

def clamp(obj,body,frame,collide=True):
    result=original_clamp(obj,body,frame,collide)
    offset=context['capVertices']; rows=[]
    for index,card in enumerate(context['cards']):
        count=len(card['rings'])*2
        points=[(v.co.x,v.co.z,-v.co.y) for v in obj.data.vertices[offset:offset+count]]
        points=sorted(tuple(0.0 if c==0 else c for c in p) for p in points)
        digest=hashlib.sha256(b''.join(struct.pack('<3f',*p) for p in points)).hexdigest()
        rows.append(dict(card=index,layer=card['layer'],strip=card['strip'],vertices=count,positionHash=digest))
        offset+=count
    assert offset==len(obj.data.vertices)
    assert len({r['positionHash'] for r in rows})==len(rows)
    out=Path(os.environ['LAYER_PROVENANCE'])
    out.write_text(json.dumps(dict(style=context['style'],cards=rows,
        sourceSha256=hashlib.sha256((pipeline/'hair_cards.py').read_bytes()).hexdigest()),indent=2)+'\n')
    return result

h.assemble_cards=assemble
h.clamp_cards_off_the_body=clamp
runpy.run_path(str(pipeline/'build_figure.py'),run_name='__main__')
