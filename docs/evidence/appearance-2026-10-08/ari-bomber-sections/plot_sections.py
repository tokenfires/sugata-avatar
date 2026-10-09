"""One diagnostic plot of stored source section witnesses, not an avatar render."""
import os
os.environ['MPLCONFIGDIR']='/tmp/sugata-ari-sections-plot'
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
from pathlib import Path
import json,numpy as np,hashlib,datetime
p=Path(__file__).resolve().parent
assert not (p/'sections-first.png').exists()
r=json.loads((p/'RESULT.json').read_text())
fig,axes=plt.subplots(2,3,figsize=(15,9),layout='constrained')
fig.suptitle('Ari bomber: source contours — shoulder association refused',fontsize=17)
for ax,s in zip(axes.flat,r['sections']):
    for i,c in enumerate(s.get('components',[])):
        q=np.asarray(c['projected_points']);q=np.vstack([q,q[0]])
        selected=i==s.get('selected_component')
        ax.plot(q[:,0],q[:,1],color='#153e63' if selected else '#aeb5bb',linewidth=1.8 if selected else 1)
    ax.add_patch(Circle((0,0),s['max_radial_extent'],fill=False,linestyle='--',color='#b95136',linewidth=1))
    ax.plot(0,0,'+',color='#111111',markersize=9)
    accepted=s.get('accepted_source_reference',False)
    ax.set_title(s['name']+' — '+('source reference' if accepted else 'REFUSED'),color='#153e63' if accepted else '#a82d1d',fontsize=12)
    ax.set_aspect('equal',adjustable='datalim');ax.grid(alpha=.15)
    ax.set_xlabel('Plane u / native units',fontsize=9);ax.set_ylabel('Plane v / native units',fontsize=9)
    if 'selected_component' in s:
        c=s['components'][s['selected_component']]
        ax.text(.02,.02,f"Extent {c['max_radial_extent']:.4f}; fixed bound {s['max_radial_extent']:.3f}",transform=ax.transAxes,fontsize=9)
ax=axes.flat[5];ax.axis('off')
ax.text(0,.92,'Geometric source diagnostic',fontsize=15,weight='bold')
ax.text(0,.80,'Blue: selected source contour\nGray: other body components\n+: authored station origin\nDashed: fixed association refusal bound',fontsize=12,linespacing=1.6)
ax.text(0,.43,'Four source references retained.\nShoulder contour spans a broad body section:\n0.5028 extent exceeds fixed 0.125 bound.\nNo later station attempted.',fontsize=12,linespacing=1.5)
ax.text(0,.16,'Evaluated body triangle IDs only.\nNo garment, ease, physical fit,\nmotion or appearance qualification.',fontsize=11,linespacing=1.4)
fig.savefig(p/'sections-first.png',dpi=120,facecolor='#faf9f6')
plt.close(fig)
b=(p/'sections-first.png').read_bytes();(p/'PLOT.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file':'sections-first.png','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'figure_role':'source geometry only; not avatar appearance','source_result_sha256':hashlib.sha256((p/'RESULT.json').read_bytes()).hexdigest(),'first_and_only':True},indent=2)+'\n')
print({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
