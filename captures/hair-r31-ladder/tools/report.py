import json, sys, itertools, math

def load(p):
    d = json.load(open(p))
    idx = {}
    for r in d['rows']:
        idx[(r['groom'], r['arm'])] = r
    return d, idx

def m(idx, groom, arm):
    return idx[(groom, arm)]['msPerFrame']['min']

GROOMS = ['floor16','bob496','bob992','bob2480','bob4960','bob11408','bob24800','sintel11400',
          'strat496','strat992','strat2480','strat4960']

def fit(xs, ys):
    n=len(xs); sx=sum(xs); sy=sum(ys); sxx=sum(x*x for x in xs); sxy=sum(x*y for x,y in zip(xs,ys))
    slope=(n*sxy-sx*sy)/(n*sxx-sx*sx); inter=(sy-slope*sx)/n
    ss_tot=sum((y-sy/n)**2 for y in ys); ss_res=sum((y-(inter+slope*x))**2 for x,y in zip(xs,ys))
    return slope, inter, 1-ss_res/ss_tot if ss_tot else float('nan')

for path in sys.argv[1:]:
    d, idx = load(path)
    g = d['contentionGate']
    print('='*100)
    print(f"{path}   viewport {d['viewport']}   batch {d['batch']}  repeats {d['repeats']}  (minima over {d['repeats']} batches)")
    print(f"CONTENTION GATE (fixed compute, unrelated to renderer): min {g['ms']['min']:.3f}  med {g['ms']['median']:.3f}  max {g['ms']['max']:.3f} ms   spread {g['spreadPctOfMin']:.2f}% of min")
    print('per-round gate ms: ' + ' '.join(f"{x:.2f}" for x in g['perRoundMs']))
    floor = m(idx,'floor16','3:0:0')
    print(f"TRUE SCENE FLOOR (16-strand groom, mode3 lod0): {floor:.4f} ms  -- head+eyes+shadowmap+ao+present, no hair work\n")
    hdr = f"{'groom':<12}{'strands':>8}{'whole+sim':>11}{'sim':>8}{'swOIT':>8}{'binning':>9}{'hw+shad':>9}{'LOD0resid':>11}{'hairTotal':>11}{'gate':>8}"
    print(hdr); print('-'*len(hdr))
    for gr in GROOMS:
        if (gr,'0:1:100') not in idx: continue
        n   = idx[(gr,'0:0:100')]['strandsRendered']
        w   = m(idx,gr,'0:1:100')
        f0  = m(idx,gr,'0:0:100')
        t1  = m(idx,gr,'1:0:100')
        t3  = m(idx,gr,'3:0:100')
        z0  = m(idx,gr,'0:0:0')
        z3  = m(idx,gr,'3:0:0')
        print(f"{gr:<12}{n:>8}{w:>11.4f}{w-f0:>8.4f}{f0-t1:>8.4f}{t1-t3:>9.4f}{t3-z3:>9.4f}{z3:>11.4f}{f0-z0:>11.4f}{g['ms']['min']:>8.2f}")
    print()
    print('  whole+sim = mode0 sim1 lod100 (the shipped frame)')
    print('  sim       = (mode0 sim1) - (mode0 sim0)')
    print('  swOIT     = (mode0 sim0) - (mode1 sim0)   [hairTileSort + hairFine]')
    print('  binning   = (mode1 sim0) - (mode3 sim0)   [clears + hairTiles + hairCombine]')
    print('  hw+shad   = (mode3 lod100) - (mode3 lod0) [shadowmap-hair + hwHair, LOD-gated part]')
    print('  LOD0resid = mode3 lod0: the scene floor PLUS hairShadingPass, which dispatches over')
    print('              hairObject.strandsCount and is NOT LOD-gated (hairShadingPass.ts:57)')
    print('  hairTotal = (mode0 sim0 lod100) - (mode0 sim0 lod0): all LOD-gated hair work,')
    print('              with each groom differenced against ITSELF so the un-gated term cancels')
    print()

    # --- ladder fits on OUR groom
    print('OUR GROOM: genuinely different .tfx exports at each density (NOT prefixes)')
    bob = [(496,'bob496'),(992,'bob992'),(2480,'bob2480'),(4960,'bob4960'),(11408,'bob11408'),(24800,'bob24800')]
    xs=[n/1000 for n,_ in bob]; ysW=[m(idx,gr,'0:0:100') for _,gr in bob]; ysH=[m(idx,gr,'0:0:100')-m(idx,gr,'0:0:0') for _,gr in bob]
    for label, ys in (('mode0 sim0 whole frame', ysW), ('LOD-gated hair only', ysH)):
        s,i,r2 = fit(xs,ys); print(f"  fit all 6 densities, {label:<24}: {s:.4f} ms per 1000 strands, intercept {i:.4f} ms, R2 {r2:.4f}")
        s,i,r2 = fit(xs[1:],ys[1:]); print(f"  fit >=992,            {label:<24}: {s:.4f} ms per 1000 strands, intercept {i:.4f} ms, R2 {r2:.4f}")
    print()

    # --- prefix vs stratified
    print('PREFIX-LOD ARTEFACT: same strand count, prefix subsample vs spatially stratified')
    pref = [(496,'0:0:4.34344'),(992,'0:0:8.69127'),(2480,'0:0:21.73475'),(4960,'0:0:43.47388')]
    z = m(idx,'bob11408','0:0:0')
    print(f"  {'strands':>8}{'prefix dMs':>12}{'strat dMs':>12}{'prefix/strat':>14}")
    px=[];py=[];sx=[];sy=[]
    for n,arm in pref:
        got = idx[('bob11408',arm)]['strandsRendered']
        assert got==n, (n,got)
        dp = m(idx,'bob11408',arm) - z
        ds = m(idx,f'strat{n}','0:0:100') - m(idx,f'strat{n}','0:0:0')
        px.append(n/1000); py.append(dp); sx.append(n/1000); sy.append(ds)
        print(f"  {n:>8}{dp:>12.4f}{ds:>12.4f}{dp/ds:>14.3f}")
    dfull = m(idx,'bob11408','0:0:100') - z
    px.append(11.408); py.append(dfull); sx.append(11.408); sy.append(dfull)
    print(f"  {11408:>8}{dfull:>12.4f}{dfull:>12.4f}{1.0:>14.3f}   (same object; the two ladders meet here)")
    s,i,r2=fit(px,py); print(f"  prefix ladder slope     {s:.4f} ms/1000 strands, intercept {i:.4f}, R2 {r2:.4f}")
    s2,i2,r22=fit(sx,sy); print(f"  stratified ladder slope {s2:.4f} ms/1000 strands, intercept {i2:.4f}, R2 {r22:.4f}")
    print(f"  prefix slope is {s/s2:.3f}x the stratified slope")
    print()

    # --- knee
    print('FIXED-COST KNEE (our groom, mode0 sim0, minima):')
    b496 = m(idx,'bob496','0:0:100'); b11408 = m(idx,'bob11408','0:0:100')
    f16  = m(idx,'floor16','0:0:100')
    print(f"  true scene floor (16 strands)          {f16:.4f} ms")
    print(f"  0     -> 496   strands costs           {b496-f16:.4f} ms")
    print(f"  496   -> 11408 strands costs           {b11408-b496:.4f} ms")
    print(f"  fixed share of the 11408 frame:        {(b496-0)/b11408*100:.1f}% is reached by 496 strands")
    print(f"  fraction of 0->11408 cost paid by first 496 strands: {(b496-f16)/(b11408-f16)*100:.1f}%")
    print()

    # --- sintel comparison
    print('OUR GROOM vs THEIR SINTEL GROOM at matched strand count (11408 vs 11400):')
    rows=[('whole frame + sim','0:1:100',None),]
    def pair(name, val_b, val_s):
        print(f"  {name:<22}{val_s:>10.4f}{val_b:>10.4f}{val_b/val_s:>10.3f}x")
    print(f"  {'':<22}{'sintel':>10}{'ours':>10}{'ratio':>10}")
    pair('whole frame + sim', m(idx,'bob11408','0:1:100'), m(idx,'sintel11400','0:1:100'))
    pair('sim', m(idx,'bob11408','0:1:100')-m(idx,'bob11408','0:0:100'), m(idx,'sintel11400','0:1:100')-m(idx,'sintel11400','0:0:100'))
    pair('swOIT', m(idx,'bob11408','0:0:100')-m(idx,'bob11408','1:0:100'), m(idx,'sintel11400','0:0:100')-m(idx,'sintel11400','1:0:100'))
    pair('binning', m(idx,'bob11408','1:0:100')-m(idx,'bob11408','3:0:100'), m(idx,'sintel11400','1:0:100')-m(idx,'sintel11400','3:0:100'))
    pair('hw raster + shading', m(idx,'bob11408','3:0:100')-m(idx,'bob11408','3:0:0'), m(idx,'sintel11400','3:0:100')-m(idx,'sintel11400','3:0:0'))
    pair('LOD-0 residual', m(idx,'bob11408','3:0:0'), m(idx,'sintel11400','3:0:0'))
    pair('LOD-gated hair total', m(idx,'bob11408','0:0:100')-m(idx,'bob11408','0:0:0'), m(idx,'sintel11400','0:0:100')-m(idx,'sintel11400','0:0:0'))
    print()
