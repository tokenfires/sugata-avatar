import json, statistics
D='captures/hair-r31-ladder-ours/data/'
def load(f): return json.load(open(D+f))
runs={'A':load('strand-time-runA.json'),'B':load('strand-time-runB.json'),'C':load('strand-time-runC-shadows.json')}
crop=load('strand-time-crop.json')

def q(v,p):
    s=sorted(v); i=(len(s)-1)*p; lo=int(i); hi=-(-i//1); hi=int(hi)
    return s[lo] if lo==hi else s[lo]+(s[hi]-s[lo])*(i-lo)

def table(rep,label):
    out={}
    for sess in rep['sessions']:
        res=sess['resolution']
        rows={r['key']:r for r in sess['rows']}
        empty=q(rows['empty']['samplesMs'],0.05)
        for k,r in rows.items():
            if r['kind'] not in ('strands','strands-shadow'): continue
            out[(res,k)]=(q(r['samplesMs'],0.05)-empty, r['strands'], r['submittedTriangles'], empty)
    return out

print("### BOB — p05 minus empty-frame arm, ms, three independent processes")
tA,tB,tC=table(runs['A'],'A'),table(runs['B'],'B'),table(runs['C'],'C')
for res in ('720x900','1920x1080'):
    print(f"\n-- {res} --")
    print(f"{'arm':<16}{'runA':>9}{'runB':>9}{'runC':>9}{'spread%':>9}")
    keys=[k for (r,k) in tC if r==res]
    for k in sorted(set(keys), key=lambda x:(('shadow' in x), int(x.split('+')[0][1:]))):
        vals=[t.get((res,k),(None,))[0] for t in (tA,tB,tC)]
        v=[x for x in vals if x is not None]
        sp=(max(v)-min(v))/min(v)*100
        s=''.join(f"{x:9.4f}" if x is not None else f"{'-':>9}" for x in vals)
        print(f"{k:<16}{s}{sp:9.1f}")

print("\n### CROP")
tCrop=table(crop,'crop')
for (res,k),(v,n,tri,e) in sorted(tCrop.items()):
    print(f"{res:<11}{k:<16}{n:>7} strands {tri:>9} tri  {v:8.4f} ms")

print("\n### two-resolution decomposition: fixed (geometry-bound) vs per-Mpx")
MP={'720x900':720*900/1e6,'1920x1080':1920*1080/1e6}
def decomp(t,keys):
    for k in keys:
        a=t.get(('720x900',k)); b=t.get(('1920x1080',k))
        if not a or not b: continue
        slope=(b[0]-a[0])/(MP['1920x1080']-MP['720x900'])
        fixed=a[0]-MP['720x900']*slope
        print(f"  {k:<16} fixed {fixed:7.4f} ms   +{slope:7.4f} ms/Mpx   (720 {a[0]:.4f}, 1080 {b[0]:.4f})")
decomp(tC,[f's{n}' for n in (496,992,2480,4960,11408,24800)]+[f's{n}+shadow' for n in (496,992,2480,4960,11408)])
print(" crop:")
decomp(tCrop,['s3840','s8832','s3840+shadow','s8832+shadow'])
