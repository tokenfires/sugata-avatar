"""Isolated candidate: cut crop01's coverage layer to its existing underlayer cut field."""
import runpy, sys
from pathlib import Path
pipeline=Path.cwd()/'tools/figure-pipeline'
sys.path.insert(0,str(pipeline))
import hair_cards as h
original=h.apply_style

def apply_style(style):
    original(style)
    assert style=='crop01', 'This experiment is scoped to crop01'
    root=next(layer for layer in h.HAIR_LAYERS if layer['name']=='root')
    under=next(layer for layer in h.HAIR_LAYERS if layer['name']=='underlayer')
    assert root['cut'] is None
    root['cut']=under['cut']
    print('ROOT CUT: None ->',root['cut'],'(existing underlayer field); counts, roots, width and RNG unchanged')

h.apply_style=apply_style
runpy.run_path(str(Path(__file__).with_name('tag-layers.py')),run_name='__main__')
