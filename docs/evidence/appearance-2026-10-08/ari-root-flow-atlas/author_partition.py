"""Freeze one artist partition from original source data, without Blender/curl mutation."""
from pathlib import Path
import json,math,hashlib,datetime
P=Path(__file__).resolve().parent
land=json.loads((P/'LANDMARKS.json').read_text());old=P.parent/'ari-curl-first-study';domain=json.loads((old/'PATCH-DOMAIN.json').read_text())
h=land['head_bone'];z0=h['head_local'][2];H=h['tail_local'][2]-z0;y0=h['head_local'][1];assert H>0 and math.isfinite(H)
# Artist choices fixed before firstatlas render. These do notfit the rejectedcoil arrays.
margin=.07*H;crown=z0+.65*H;temple=land['eye_owner_bounds']['max'][2]+.10*H;forehead=land['eye_owner_bounds']['max'][2]+.18*H;back=y0+.30*H;front=y0-.35*H;nape=z0+.04*H
boxes={s:{'min':[v-margin for v in b['min']],'max':[v+margin for v in b['max']]} for s,b in land['ear_source_group_bounds'].items()}
zones={n:[] for n in ['crown','temple','nape']};excluded=[]
for row in domain['patch']:
 pts=row['coordinates'];lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)];cen=[sum(p[k] for p in pts)/3 for k in range(3)]
 overlaps=[side for side,b in boxes.items() if all(hi[k]>=b['min'][k] and lo[k]<=b['max'][k] for k in range(3))]
 if overlaps:reason='ear_envelope_overlap:'+','.join(overlaps)
 elif cen[1]<front and min(p[2] for p in pts)<forehead:reason='open_forehead_boundary'
 elif min(p[2] for p in pts)>=crown:zone='crown';reason=None
 elif cen[1]>=back and min(p[2] for p in pts)>=nape:zone='nape';reason=None
 elif min(p[2] for p in pts)>=temple:zone='temple';reason=None
 else:reason='short_side_nape_boundary'
 out={'triangle':row['triangle'],'polygon':row['polygon'],'vertices':row['vertices'],'coordinates':pts,'normal':row['normal'],'centroid':cen,'area':row['area']}
 if reason:out['reason']=reason;excluded.append(out)
 else:out['zone']=zone;zones[zone].append(out)
assert all(zones.values());guides=[]
for zone,rows in zones.items():
 ordered=sorted(rows,key=lambda r:(r['centroid'][0],r['centroid'][1],r['triangle']))
 for i in [len(rows)//6,len(rows)//2,5*len(rows)//6]:
  row=ordered[i];root=row['centroid'];n=row['normal'];nom={'crown':[.15,1,-.2],'temple':[0,.5,-1],'nape':[0,.2,-1]}[zone];dot=sum(n[k]*nom[k] for k in range(3));d=[nom[k]-dot*n[k] for k in range(3)];length=math.sqrt(sum(x*x for x in d));assert length>1e-8;d=[x/length for x in d];start=[root[k]+n[k]*.03*H for k in range(3)];end=[start[k]+d[k]*(.12 if zone=='crown' else .09)*H for k in range(3)]
  assert not any(all(b['min'][k]<=p[k]<=b['max'][k] for k in range(3)) for b in boxes.values() for p in [start,end])
  guides.append({'zone':zone,'source_triangle':row['triangle'],'source_vertices':row['vertices'],'root_centroid':root,'normal':n,'start':start,'end':end,'direction':d,'purpose':'Drawn surface-tangent flow intent, not hair/contact clearance.'})
def boundaries(rows):
 counts={};which={}
 for r in rows:
  v=r['vertices']
  for a,b in [(v[0],v[1]),(v[1],v[2]),(v[2],v[0])]:e=tuple(sorted((a,b)));counts[e]=counts.get(e,0)+1;which.setdefault(e,[]).append(r['triangle'])
 return [{'vertices':list(e),'source_triangles':which[e]} for e,c in sorted(counts.items()) if c==1]
out={'authored_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_sha256':'8d28c905e95f92c1c689df495ee30a4cf4bbe55e069b4cc8ae345c59d3f069a4','landmarks':land,'artist_thresholds':{'head_H':H,'head_z0':z0,'ear_padding_H':.07,'ear_padding_m':margin,'crown_z':crown,'temple_z':temple,'front_boundary_y':front,'forehead_z':forehead,'back_boundary_y':back,'nape_z':nape},'ear_intent_boxes':boxes,'zones':zones,'excluded':excluded,'boundaries':{n:boundaries(rows) for n,rows in zones.items()},'guides':guides,'materials':{'crown':[.95,.5,.08,1],'temple':[.5,.22,.8,1],'nape':[.08,.65,.4,1],'flow':[1,1,1,1]},'overlay_offset_m':.0006,'guide_radius_m':.0008,'limits':'Originalsource-bound artistatlas only; no curls/physicalclearance/hairline/identity/motion approval.'}
origin=h['head_local'];out['normalized_frame']={'origin':origin,'scale_head_H_m':H,'axes':'Original worldX/Y/Z; normalized=(point-origin)/H'}
for rows in list(out['zones'].values())+[out['excluded']]:
 for row in rows:row['normalized_centroid']=[(row['centroid'][i]-origin[i])/H for i in range(3)];row['normalized_vertices']=[[(pt[i]-origin[i])/H for i in range(3)] for pt in row['coordinates']]
for g in out['guides']:
 for key in ['root_centroid','start','end']:g['normalized_'+key]=[(g[key][i]-origin[i])/H for i in range(3)]
with (P/'PARTITION.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({'zones':{k:len(v) for k,v in zones.items()},'excluded':len(excluded),'guides':len(guides),'thresholds':out['artist_thresholds']},indent=2))
