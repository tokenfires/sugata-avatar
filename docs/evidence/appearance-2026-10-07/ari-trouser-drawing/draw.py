"""Author one original unitless technical SVG; no image input, tracing or raster editing."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as E

HERE = Path(__file__).resolve().parent
SVG = HERE / 'trouser.svg'
DESIGN = HERE / 'design.json'
if SVG.exists() or DESIGN.exists():
    raise SystemExit('Refuse overwriting first source artwork')

used = set()
serial = 0
def el(parent, tag, attrs=None, text=None, ident=None):
    global serial
    serial += 1
    ident = ident or f'element-{serial:03d}'
    if ident in used:
        raise ValueError(ident)
    used.add(ident)
    attrs = {'id': ident, **(attrs or {})}
    node = E.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})
    if text is not None:
        node.text = text
    return node

root = E.Element('svg', {'xmlns':'http://www.w3.org/2000/svg', 'id':'ari-trouser-sheet',
                        'width':'1800', 'height':'1500', 'viewBox':'0 0 1800 1500',
                        'role':'img', 'aria-labelledby':'sheet-title sheet-description'})
used.add(root.attrib['id'])
el(root, 'title', text='Ari — flat-front ink trousers, original construction proposal', ident='sheet-title')
el(root, 'desc', text='Unitless authored front, right profile and rear with inside-front, exploded fly and hem proposals. No pleats or rear pockets selected. Not a pattern, registered projection or physical fit proof.', ident='sheet-description')
el(root, 'style', text='''
text{font-family:Arial,sans-serif;fill:#223844;font-size:19px}
.title{font-size:36px;font-weight:bold}.subtitle{font-size:21px}
.panel-title{font-size:24px;font-weight:bold}.small{font-size:17px}.tiny{font-size:16px}
.shell{fill:#e2e8ec;stroke:#223844;stroke-width:2.6;stroke-linejoin:round}
.waist{fill:#c4d2dc;stroke:#223844;stroke-width:2.3;stroke-linejoin:round}
.seam{fill:none;stroke:#536f80;stroke-width:2.1;stroke-linecap:round}
.guide{fill:none;stroke:#ad6742;stroke-width:2;stroke-dasharray:7 5}
.zip{fill:none;stroke:#647f89;stroke-width:4;stroke-dasharray:1 7;stroke-linecap:round}
.bag{fill:#d1e6dc;fill-opacity:.88;stroke:#35675b;stroke-width:2.2}
.leader{fill:none;stroke:#70838d;stroke-width:1.5}
.hidden{fill:none;stroke:#9ca9b0;stroke-width:1.8;stroke-dasharray:4 5}
.frame{fill:#ffffff;stroke:#dde5e9;stroke-width:1.4}
''', ident='sheet-style')
el(root, 'rect', {'width':1800,'height':1500,'fill':'#f5f7f8'}, ident='paper')
el(root, 'text', {'x':50,'y':58,'class':'title'}, 'ARI / INK TROUSERS', ident='heading')
el(root, 'text', {'x':50,'y':91,'class':'subtitle'}, 'Flat front · shaped waistband · fly · paired side-pocket bags', ident='subheading')
el(root, 'text', {'x':50,'y':124,'class':'small'}, 'ORIGINAL UNITLESS ART  /  authored alternative to the unqualified pleated prompt  /  no rear pockets selected', ident='authorship-note')
el(root, 'rect', {'x':1630,'y':42,'width':115,'height':35,'fill':'#293d4b','rx':3}, ident='ink-swatch')
el(root, 'text', {'x':1605,'y':104,'class':'tiny'}, 'ink / matte intent', ident='swatch-caption')

def frame(x,y,w,h,title,subtitle,nid):
    g=el(root,'g',ident=nid)
    el(g,'rect',{'x':x,'y':y,'width':w,'height':h,'rx':14,'class':'frame'})
    el(g,'text',{'x':x+22,'y':y+37,'class':'panel-title'},title)
    el(g,'text',{'x':x+22,'y':y+64,'class':'small'},subtitle)
    return g

def group(parent, ident, role, transform=None, side=None):
    attrs={'data-role':role}
    if transform:attrs['transform']=transform
    if side:attrs['data-side']=side
    return el(parent,'g',attrs,ident=ident)

def path(parent,d,cls='seam',ident=None):return el(parent,'path',{'d':d,'class':cls},ident=ident)
def txt(parent,x,y,s,cls='small',ident=None):return el(parent,'text',{'x':x,'y':y,'class':cls},s,ident)
def leader(parent,d,ident=None):return path(parent,d,'leader',ident)

front_frame=frame(50,160,535,660,'01 / FRONT','Closed intent; waist is a new authored proposal','front-frame')
front=group(front_frame,'front-view','shell','translate(96 258)')
right_d='M78 30 Q132 18 188 18 L188 216 Q176 235 174 262 L161 535 Q115 548 65 530 L56 208 Q52 100 78 30 Z'
left_d='M188 18 Q244 18 296 30 Q320 100 315 208 L306 530 Q265 548 214 535 L202 262 Q199 235 188 216 Z'
path(group(front,'front-shell-R','shell',side='wearer-right'),right_d,'shell','front-panel-R')
path(group(front,'front-shell-L','shell',side='wearer-left'),left_d,'shell','front-panel-L')
waist=group(front,'front-waist','waistband')
path(waist,'M78 30 Q132 18 195 18 L195 52 Q131 48 75 61 Z','waist','front-WB-R')
path(waist,'M178 18 Q245 18 296 30 L300 61 Q243 49 178 52 Z','waist','front-WB-L')
el(waist,'circle',{'cx':185,'cy':35,'r':5,'fill':'#223844'},ident='front-top-fastening')
path(waist,'M175 35 L195 35','seam','front-WB-L-slot-intent')
fly=group(front,'front-fly','fly')
path(fly,'M178 54 L178 139 Q179 157 196 159','seam','front-F-L-overlap-fold')
path(fly,'M190 60 L190 142','hidden','front-F-R-hidden-underlap')
pockets=group(front,'front-pockets','pockets')
path(pockets,'M114 65 L69 130','seam','front-P-R')
path(pockets,'M262 65 L307 130','seam','front-P-L')
hem=group(front,'front-hems','hem')
path(hem,'M67 514 Q115 527 163 518 M212 518 Q260 527 308 514','guide','front-H-R-L-turn')
leader(front,'M82 86 L26 70 L0 70');txt(front,-4,61,'P-R')
leader(front,'M294 86 L353 70 L390 70');txt(front,355,61,'P-L')
leader(front,'M183 90 L337 130 L390 130');txt(front,321,154,'F-L over F-R')
txt(front,103,579,'R',ident='front-right-label');txt(front,260,579,'L',ident='front-left-label')
txt(front_frame,72,797,'Outer edges + inseams belong to separate front panel roles.','tiny')

profile_frame=frame(610,160,495,660,'02 / AUTHORED RIGHT PROFILE','Front is image-left; far pocket and fly layers hidden','profile-frame')
profile=group(profile_frame,'right-profile','shell','translate(674 258)')
path(profile,'M110 30 Q161 17 226 31 Q276 71 277 147 Q271 197 257 228 L259 525 Q218 541 164 532 L146 283 Q116 236 94 179 Q82 111 110 30 Z','shell','profile-near-R-shell')
path(profile,'M153 282 L137 525 Q157 539 177 533','hidden','profile-far-leg-hidden')
pw=group(profile,'profile-waist','waistband',side='wearer-right')
path(pw,'M110 30 Q160 17 226 31 L242 62 Q168 45 101 61 Z','waist','profile-WB-near')
pp=group(profile,'profile-pocket','pockets',side='wearer-right')
path(pp,'M134 65 Q112 87 98 130','seam','profile-P-R')
path(profile,'M191 56 Q220 157 208 268 L211 521','seam','profile-outer-leg-seam-R')
path(profile,'M165 516 Q209 529 257 512','guide','profile-H-R-turn').set('data-role','hem')
leader(profile,'M100 105 L35 99 L0 99');txt(profile,-1,87,'P-R / near')
leader(profile,'M266 124 L319 102 L354 102');txt(profile,297,88,'seat / authored')
txt(profile,82,579,'CF ←',ident='profile-front-direction')
txt(profile_frame,632,797,'Depth and fall are artistic choices, not registered projection.','tiny')

rear_frame=frame(1130,160,620,660,'03 / REAR','Centre/seat seam; plain rear without pockets','rear-frame')
rear=group(rear_frame,'rear-view','shell','translate(1240 258)')
path(rear,'M73 29 Q131 14 188 17 L188 226 Q174 243 172 276 L155 534 Q106 550 56 530 L46 207 Q46 100 73 29 Z','shell','rear-panel-L')
path(rear,'M188 17 Q245 14 303 29 Q330 100 330 207 L320 530 Q270 550 221 534 L204 276 Q202 243 188 226 Z','shell','rear-panel-R')
rw=group(rear,'rear-waist','waistband')
path(rw,'M73 29 Q188 3 303 29 L309 61 Q188 43 67 61 Z','waist','rear-WB-B')
rs=group(rear,'rear-seat-seam','seat')
path(rs,'M188 51 L188 226','seam','rear-centre-seat-seam')
path(rs,'M181 55 L181 222 M195 55 L195 222','guide','rear-centre-attachment-intent')
rh=group(rear,'rear-hems','hem')
path(rh,'M58 514 Q108 529 157 518 M219 518 Q270 529 318 514','guide','rear-H-L-R-turn')
leader(rear,'M188 157 L365 118 L414 118');txt(rear,339,103,'centre / seat seam')
txt(rear,88,579,'L',ident='rear-left-label');txt(rear,271,579,'R',ident='rear-right-label')
txt(rear_frame,1152,797,'Garment contours + inseams; no anatomy tracing.','tiny')

inside_frame=frame(50,845,695,480,'04 / INSIDE FRONT ONLY','Back and full legs omitted; bag envelopes are proposals','inside-frame')
inside=group(inside_frame,'inside-front','inside','translate(84 952)')
path(inside,'M78 30 Q188 8 296 30 Q318 116 315 210 L306 224 L290 216 L274 224 L258 216 L242 224 L226 216 L210 224 L194 216 L178 224 L162 216 L146 224 L130 216 L114 224 L98 216 L82 224 L56 210 Q54 112 78 30 Z','shell','inside-cropped-front-shell')
iw=group(inside,'inside-waist','waistband')
path(iw,'M78 30 Q132 18 195 18 L195 52 Q131 48 75 61 Z','waist','inside-WB-R')
path(iw,'M178 18 Q245 18 296 30 L300 61 Q243 49 178 52 Z','waist','inside-WB-L')
for side,transform in [('R',None),('L','translate(376 0) scale(-1 1)')]:
    bag=group(inside,'inside-bag-'+side,'bags',transform,side='wearer-right' if side=='R' else 'wearer-left')
    path(bag,'M92 56 L154 56 L167 177 Q170 209 143 216 Q98 223 69 197 L69 130 L114 65 Z','bag','inside-B-'+side)
    path(bag,'M114 65 L69 130','seam','inside-P-'+side+'-mouth-correspondence')
    path(bag,'M92 56 L154 56 M69 130 L68 178','guide','inside-B-'+side+'-top-side-anchor')
ifl=group(inside,'inside-fly','fly')
path(ifl,'M185 52 L173 52 L173 160 L188 160 Z','shell','inside-F-R-guard')
path(ifl,'M178 52 L205 52 L207 150 Q207 166 181 166 Z','waist','inside-F-L-facing')
path(ifl,'M183 59 L183 146','zip','inside-Z-R-half')
path(ifl,'M194 59 L194 146','zip','inside-Z-L-half')
txt(inside,112,248,'B-R',ident='inside-B-R-label');txt(inside,248,248,'B-L',ident='inside-B-L-label')
leader(inside,'M146 58 L376 40 L416 40');txt(inside,411,34,'top anchor / waist')
leader(inside,'M306 147 L375 104 L416 104');txt(inside,411,96,'side anchor')
leader(inside,'M198 117 L375 171 L416 171');txt(inside,411,163,'facing / guard / zip')
txt(inside_frame,72,1288,'Jagged lower edge = diagram crop, not a cut-piece boundary.','tiny')

fly_frame=frame(770,845,540,480,'05 / FLY LAYER ROLES','Exploded discussion diagram; engagement unproved','fly-frame')
detail=group(fly_frame,'fly-detail','fly','translate(796 951)')
path(detail,'M34 22 L153 22 L153 192 Q151 222 87 222 L34 211 Z','waist','detail-F-L-overlap-facing')
path(detail,'M221 22 L321 22 L321 213 L221 213 Z','shell','detail-F-R-underlap-guard')
path(detail,'M143 44 L143 181','zip','detail-Z-L-half')
path(detail,'M231 44 L231 181','zip','detail-Z-R-half')
fastening=group(detail,'detail-top-fastening','waistband')
el(fastening,'circle',{'cx':271,'cy':40,'r':6,'fill':'#223844'},ident='detail-WB-R-button-proposal')
path(fastening,'M77 40 L95 40','seam','detail-WB-L-slot-proposal')
txt(fastening,34,11,'WB-L / slot','tiny')
txt(fastening,221,11,'WB-R / button','tiny')
path(detail,'M187 64 L174 64 M174 64 L180 58 M174 64 L180 70','leader','detail-left-overlap-direction')
txt(detail,38,253,'F-L / left overlap')
txt(detail,217,253,'F-R / right underlap')
txt(detail,38,281,'Z-L');txt(detail,222,281,'Z-R')
txt(detail,33,315,'Front left overlap covers right underlap.')
txt(fly_frame,792,1288,'Two zipper-half roles; no teeth matching or closure proof.','tiny')

hem_frame=frame(1335,845,415,480,'06 / HEM TURN INTENT','No depth, ease or seam allowance specified','hem-frame')
hd=group(hem_frame,'hem-detail','hem','translate(1368 967)')
path(hd,'M35 27 L294 27 L286 157 Q162 170 43 157 Z','shell','hem-outer-leg')
path(hd,'M43 157 Q162 170 286 157 L285 124 Q164 137 44 124 Z','waist','hem-turned-envelope')
path(hd,'M47 132 Q163 145 281 132','guide','hem-turn-attachment-guide')
txt(hd,37,211,'H-R / H-L repeated role')
txt(hd,37,243,'Turn envelope is schematic.')
txt(hd,37,275,'Leg opening + drape unqualified.')
txt(hem_frame,1357,1288,'Pattern, fabric and physical fit remain open.','tiny')

legend=group(root,'legend','legend')
path(legend,'M54 1374 L139 1374','guide','legend-attachment');txt(legend,156,1380,'proposed attachment / turn','small')
path(legend,'M547 1374 L632 1374','zip','legend-zip');txt(legend,650,1380,'zip-half intent','small')
el(legend,'rect',{'x':926,'y':1360,'width':54,'height':24,'class':'bag'},ident='legend-bag-swatch');txt(legend,996,1380,'inside bag proposal','small')
path(legend,'M1395 1374 L1471 1374','hidden','legend-hidden');txt(legend,1484,1380,'hidden / far role','small')
txt(root,50,1435,'No measurements, sewing pattern, mechanical engagement, body/garment fit, 3D or runtime acceptance.','small','qualification-footer')
txt(root,50,1464,'Wearer R/L: front + inside R is image-left; rear R is image-right. All views are authored, unregistered sketches.','tiny','sides-footer')

E.indent(root, space='  ')
svg_bytes=E.tostring(root,encoding='utf-8',xml_declaration=True)
SVG.write_bytes(svg_bytes)

def tree(node, role=None, side=None):
    role=node.attrib.get('data-role',role)
    side=node.attrib.get('data-side',side)
    return {'id':node.attrib['id'],'tag':node.tag,'attributes':dict(node.attrib),
            'text':node.text.strip() if node.text and node.text.strip() else None,
            'inherited_role':role,'inherited_side':side,
            'children':[tree(c,role,side) for c in node]}

def walk(node):
    yield node
    for c in node['children']:yield from walk(c)

t=tree(root);nodes=list(walk(t));roles={}
for n in nodes:
    if n['inherited_role']:roles.setdefault(n['inherited_role'],[]).append(n['id'])
design={'title':'Ari original flat-front ink trouser construction proposal','units':'unitless SVG coordinates',
        'viewport':[1800,1500],'source':'trouser.svg','source_sha256':hashlib.sha256(svg_bytes).hexdigest(),
        'elements':len(nodes),'roles':roles,'tree':t,
        'sides':{'front_inside':'wearer-right image-left','rear':'wearer-right image-right','right_profile':'front image-left; near P-R; far pocket/fly layers hidden'},
        'choices':{'flat_front':'authored alternative to unqualified pleated prompt','rear_pockets':False,'pleats':False,'inside':'front upper panels only; jagged edge is diagram crop','fly':'left overlap above right underlap; separated layer diagram and zip-half proposals','bags':'two proposed envelopes; mouth/top/side correspondence, capacity unproved'},
        'limits':['Not raster-traced','Not registered projections','Not cut pieces or sewing instructions','No dimensions/material calibration/zip engagement/pocket capacity/seam matching','No body/foundation/wardrobe fit, rig/motion or runtime acceptance']}
DESIGN.write_text(json.dumps(design,indent=2)+'\n')
print(json.dumps({'svg_bytes':len(svg_bytes),'svg_sha256':design['source_sha256'],'elements':design['elements'],'roles':{k:len(v) for k,v in roles.items()},'viewports':design['viewport']},indent=2))
