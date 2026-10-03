"""One literal artist-authored network; CPU JSON and orthographic SVG, no mesh/Avatar."""
from pathlib import Path
import json,hashlib,datetime,os,math
p=Path('docs/evidence/nonhair-2026-10-03/control-net-authorship');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert started<'2026-10-03T17:42:00'
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
for q,h in json.loads((p/'INPUTS.json').read_text()).items():assert sha(Path(q))==h,q
# All values below are artistic metres in the pinned raw g050 body POSITION frame.
part=[[.016,1.643,.111],[.018,1.669,.080],[.018,1.679,.030],[.018,1.666,-.043],[.018,1.623,-.090]]
minus=[part,
 [[.000,1.632,.150],[-.035,1.661,.120],[-.068,1.670,.044],[-.050,1.650,-.050],[.000,1.592,-.092]],
 [[-.050,1.595,.159],[-.082,1.618,.130],[-.099,1.635,.040],[-.085,1.615,-.055],[.000,1.572,-.097]],
 [[-.067,1.553,.140],[-.095,1.564,.122],[-.105,1.567,.038],[-.088,1.565,-.057],[.000,1.550,-.100]],
 [[-.070,1.492,.122],[-.086,1.510,.106],[-.096,1.518,.029],[-.083,1.508,-.060],[.000,1.492,-.104]],
 [[-.060,1.462,.095],[-.076,1.466,.074],[-.079,1.470,.008],[-.065,1.471,-.056],[.000,1.468,-.096]]]
plus=[part,
 [[.047,1.635,.139],[.070,1.660,.112],[.088,1.664,.037],[.064,1.647,-.052],[.000,1.592,-.092]],
 [[.066,1.603,.140],[.088,1.617,.118],[.105,1.633,.040],[.088,1.614,-.055],[.000,1.572,-.097]],
 [[.071,1.550,.133],[.094,1.567,.110],[.108,1.567,.034],[.088,1.565,-.057],[.000,1.550,-.100]],
 [[.073,1.500,.112],[.086,1.515,.090],[.098,1.517,.025],[.082,1.507,-.060],[.000,1.492,-.104]],
 [[.064,1.474,.089],[.076,1.476,.066],[.079,1.474,.008],[.065,1.471,-.056],[.000,1.468,-.096]]]
u=[0,.25,.5,.75,1];v=[0,.14,.31,.55,.80,1];sectionNames=['part/crown','root-lift/hairline','temple','cheek','jaw-turn','inward hem']
def derivative(values,knots,i):
 a=max(0,i-1);b=min(len(values)-1,i+1)
 return [round((values[b][k]-values[a][k])/(knots[b]-knots[a]),9)for k in range(3)]
def node_id(side,j,i):return 'part-'+str(i) if j==0 else 'back-'+str(j) if i==4 else side+'-'+str(j)+'-'+str(i)
net={'kind':'author-only full rounded-bob control net, not mesh/fit/appearance','authoredBy':'root, one explicit hypothesis','units':'metres','coordinateFrame':{'asset':'assets/figures/figure_g050.glb','sha256':'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14','space':'raw exported body POSITION; X lateral, Y up, Z front; +X matches original eye.geometry.left.centre sign','registration':'crown/eye/brow records anchor scale only; free net coordinates are NOT projected/registered to skin','crownAnchor':[0,1.6594313383,.0501729473]},'artisticChoice':{'partSide':'proposed +X part, heavier minusX framing and lighter plusX reveal','length':'proposed jaw/chin-adjacent asymmetric hem; not Robert-approved exact length','rootLift':'maximum authored Y1.679, 19.569mm above source crown point; this is not minimum surface clearance','intent':'rounded all-around crown/back volume, unequal curved front opening and inward ends; no reference coordinate transfer'},'u':u,'v':v,'sectionNames':sectionNames,'panels':{},'joins':{'topPart':{'boundary':'both v=0; exact shared part-i node IDs; no gap strip or exposed-skin slit','positions':'G0 welded; explicit opposite lateral dv at seam gives matching tangent plane away from seam/back corner','appearance':'guide/flow part responsibility only; no promise of an exposed or photoreal part'},'back':{'boundary':'both u=1; exact shared back-j IDs; part-4 shared corner at v=0','positions':'G0 welded throughout; opposite lateral du at v>=.14; first top/back corner span only G0 is claimed','appearance':'future normals average shared seam; no promise shading removes geometric crease'},'hem':{'boundary':'both v=1 from front opening around sides to shared back-5','join':'minus and plus meet at exact back-5, making one continuous U-shaped lower boundary; each front hem end joins its own u=0 opening curve','closure':'single sheet with one closed face+hem boundary, not sealed solid volume; no underside/backing offset invented'},'frontOpening':{'boundary':'both u=0, shared part-0 at crown-front to side-specific hem endpoints','meaning':'front silhouette/hairline curve, not skin cut, projected mask or desired body vertices'}},'responsibilities':{'coverage':'all 40 bicubic cells form ONE explicit cranial/back/side sheet with top/back shared boundaries; no separate roof/cap and no gap between independently generated regions','framing':'u=0 opening curve and first circumferential band own unequal part-to-temple-to-cheek/jaw/end flow','volume':'u=.25,.5,.75 ridges/side/back stations own rounded cross-sections; all axes vary by station','hairDetail':'not supplied; later visible guide/strand material, multi-scale breakup and complete composed groom are separate qualifications'},'interpolation':{'type':'piecewise bicubic tensor Hermite, 5 longitudinal by4 circumferential cells per side','inputs':'each corner P, global du,dv,duv and exact knot widths hu,hv','basis':['h00(t)=2t^3-3t^2+1','h01(t)=-2t^3+3t^2','h10(t)=t^3-2t^2+t','h11(t)=t^3-t^2'],'formula':'sum_i,j Hp_i(s)Hp_j(t)Pij + hu Ht_i(s)Hp_j(t)duij + hv Hp_i(s)Ht_j(t)dvij + hu*hv Ht_i(s)Ht_j(t)duvij; s,t local0..1; i,j are cell endpoints','continuity':'shared node derivatives yield C1 within each panel; cross-panel seam continuity only as declared above','tangentAuthoring':'initial literal positions chosen by root; slopes are deterministic secants of THESE values, then explicit seam-direction overrides; expanded vectors retained, no old generator controls used','limits':'interpolation can overshoot; no automatic clamp/ray fitting, collision/coverage metric or mesh orientation qualification'},'attachment':{'hypothesis':'future single-head rigid ownership of all authored points; no mixed weights, dynamic strand or moving fit promise','sourceWitness':'packages/core/src/motion/HairSkinTransform.js complete formula read, SHA8bb7137ac68b88c8a2fe213f34757d44f5b6addf0b63141f29f98ab3ac4adf7e','headOwner':'named head bone must be identical to one bone in ACTUAL figure.body.skeleton; use that skeleton own inverse bind and actual body bind matrices','worldFormula':'W(t)=M_bodyWorld(t)*B_bodyInverse(t)*M_headWorld(t)*I_headFromBodySkeleton*B_body; p_world(t)=W(t)*p_raw','futureGroupParent':'figure.root, raw geometry remains unchanged; groupLocal(t)=inverse(M_figureRootWorld(t))*W(t); matrixAutoUpdate=false, update after actual rig matrices','guards':'finite invertible matrices, identity exact bone/skeleton/bind ownership, complete proper rigid full transform per existing assertRigidHairTransform; refuse mismatch','observation':'source-only formula; NO current matrix observation or Avatar construction in this slice. Previous frozen posed head matrix is explicitly NOT reused as rest registration. Future builder must record actual matrix operands before any native trial.'},'limits':['Not body-surface correspondence, minimum clearance or independently verified scalp coverage.','No topology/triangle/normal/UV/material/strand/skin-morph or native output produced.','No smoothing/reparameterization of old roof-and-wall proposal.','All geometry/appearance/moving/full-AAA gates remain future; no builder admitted.']}
for side,rows,sgn in [('minusX',minus,-1),('plusX',plus,1)]:
 nodes=[];dimensions=[]
 for j,row in enumerate(rows):
  nr=[]
  for i,pos in enumerate(row):
   du=derivative(row,u,i);dv=derivative([rows[k][i]for k in range(6)],v,j)
   if j==0:dv=[sgn*.26,0,0]
   if i==4 and j>0:du=[-sgn*.35,0,0]
   nr.append({'id':node_id(side,j,i),'P':pos,'du':du,'dv':dv,'duv':[0,0,0]})
  nodes.append(nr)
  dimensions.append({'section':sectionNames[j],'Xspan':round(max(x[0]for x in row)-min(x[0]for x in row),6),'Yspan':round(max(x[1]for x in row)-min(x[1]for x in row),6),'Zspan':round(max(x[2]for x in row)-min(x[2]for x in row),6)})
 cells=[{'uCell':i,'vCell':j,'corners':[node_id(side,j,i),node_id(side,j,i+1),node_id(side,j+1,i+1),node_id(side,j+1,i)]}for j in range(5)for i in range(4)]
 net['panels'][side]={'nodes':nodes,'sectionDimensions':dimensions,'cells':cells}
(p/'control-net.json').write_text(json.dumps(net,indent=2)+'\n')
# Schematic uses exact Hermite boundary/section curves; no surface tessellation or image editing.
colors={'minusX':'#b34d32','plusX':'#426aae'};svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="660" viewBox="0 0 1440 660">','<rect width="1440" height="660" fill="#f6f2e9"/>','<g font-family="system-ui" fill="#242923"><text x="24" y="30" font-size="22">Authored 3D control net — schematic only</text><text x="24" y="54" font-size="14">Metres in raw g050 body frame · proposed +X part · red=heavier minusX, blue=lighter plusX · no native/fit/appearance pass</text>']
projections=[('Front: X / Y',lambda a:(240+a[0]*1500,110+(1.70-a[1])*1900)),('Side: Z / Y',lambda a:(750-a[2]*1450,110+(1.70-a[1])*1900)),('Top: X / Z',lambda a:(1200+a[0]*1450,350-a[2]*1450))]
for title,project in projections:
 center=project([0,1.70,0])[0];svg.append(f'<text x="{center-150}" y="90" font-size="18">{title}</text>')
 for side,panel in net['panels'].items():
  def draw_curve(nodes,knots,key,opacity,width):
   for k in range(len(nodes)-1):
    a,b=nodes[k:k+2];delta=knots[k+1]-knots[k];A=project(a['P']);B=project(b['P']);C=project([a['P'][d]+a[key][d]*delta/3 for d in range(3)]);D=project([b['P'][d]-b[key][d]*delta/3 for d in range(3)])
    svg.append(f'<path d="M{A[0]:.3f},{A[1]:.3f} C{C[0]:.3f},{C[1]:.3f} {D[0]:.3f},{D[1]:.3f} {B[0]:.3f},{B[1]:.3f}" fill="none" stroke="{colors[side]}" stroke-width="{width}" opacity="{opacity}"/>')
  for row in panel['nodes']:draw_curve(row,u,'du',.42,1)
  for i in range(5):draw_curve([r[i]for r in panel['nodes']],v,'dv',1 if i==0 else .62,3 if i==0 else 1.5)
  for j,row in enumerate(panel['nodes']):
   for i,a in enumerate(row):
    X,Y=project(a['P']);svg.append(f'<circle cx="{X:.3f}" cy="{Y:.3f}" r="2.2" fill="{colors[side]}"/>')
   if side=='minusX':
    X,Y=project(row[0]['P']);svg.append(f'<text x="{X-105:.3f}" y="{Y:.3f}" font-size="10">{j}:{sectionNames[j]}</text>')
 # Only exact anatomical point anchors, no invented head silhouette.
 for title2,pos in [('source crown',[0,1.6594313383,.0501729473]),('left eye centre',[.02891325956495104,1.553270865142312,.1184364495259589]),('right eye centre',[-.028913189721327587,1.5532708360343765,.1184365635320821])]:
  X,Y=project(pos);svg.append(f'<circle cx="{X:.3f}" cy="{Y:.3f}" r="4" fill="#212121"/><title>{title2}</title>')
svg+=['<text x="24" y="610" font-size="14">Top and back edges use shared node IDs. Both opening curves meet part-0; the lower U-shaped hem joins at back-5.</text>','<text x="24" y="636" font-size="14">Dots are authored knots / black dots are actual scale anchors. Projected overlap is not body intersection, clearance, coverage or a hairstyle image.</text></g></svg>']
(p/'control-net.svg').write_text('\n'.join(svg)+'\n')
# Source-only structural arithmetic; no builder or Avatar imports.
assert len(net['panels'])==2
shared={};count=0
for panel in net['panels'].values():
 assert len(panel['cells'])==20
 for row in panel['nodes']:
  for a in row:
   count+=1
   assert all(len(a[k])==3 and all(math.isfinite(x)for x in a[k])for k in ['P','du','dv','duv'])
   if a['id']in shared:assert shared[a['id']]==a['P']
   else:shared[a['id']]=a['P']
assert count==60 and len(shared)==50
result={'pid':os.getpid(),'command':'python3 docs/evidence/nonhair-2026-10-03/control-net-authorship/author-net.py','started':started,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authorSourceSHA256':sha(Path(__file__)),'netSHA256':sha(p/'control-net.json'),'schematicSHA256':sha(p/'control-net.svg'),'authoredNodeRecords':count,'uniqueSharedNodeIDs':len(shared),'declaredCells':40,'status':'authored source/finite/identity graph only; no surface evaluation/mesh/fit/appearance'}
(p/'AUTHOR-RECEIPT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
