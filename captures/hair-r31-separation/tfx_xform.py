"""Rigidly re-registers an exported .tfx into another scene's frame.

Only whole-body rigid terms: a yaw about the world Y axis and a translation. Nothing here
touches a strand's SHAPE — the whole point of arm B is that the shape is what is on trial, so
the transform must be provably shape-preserving. Arc lengths are re-measured after and printed.
"""
import struct, sys, math, argparse
p=argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst')
p.add_argument('--yaw-degrees', type=float, default=0.0)
p.add_argument('--translate', nargs=3, type=float, default=[0,0,0])
a=p.parse_args()
b=bytearray(open(a.src,'rb').read())
ver,ns,nv,off=struct.unpack_from('<fIII',b,0)
c,s=math.cos(math.radians(a.yaw_degrees)),math.sin(math.radians(a.yaw_degrees))
def arcs(buf):
    out=[]
    for st in range(ns):
        L=0; prev=None
        for v in range(nv):
            i=off+(st*nv+v)*16
            x,y,z=struct.unpack_from('<3f',buf,i)
            if prev: L+=math.dist(prev,(x,y,z))
            prev=(x,y,z)
        out.append(L)
    return out
before=arcs(b)
lo=[1e9]*3; hi=[-1e9]*3
for st in range(ns):
    for v in range(nv):
        i=off+(st*nv+v)*16
        x,y,z=struct.unpack_from('<3f',b,i)
        nx = x*c + z*s
        nz = -x*s + z*c
        nx+=a.translate[0]; ny=y+a.translate[1]; nz+=a.translate[2]
        struct.pack_into('<3f',b,i,nx,ny,nz)
        for k,val in enumerate((nx,ny,nz)):
            lo[k]=min(lo[k],val); hi[k]=max(hi[k],val)
after=arcs(b)
open(a.dst,'wb').write(bytes(b))
err=max(abs(x-y) for x,y in zip(before,after))
print(f"{a.dst}  yaw {a.yaw_degrees} deg  translate {a.translate}")
print("  bbox lo %s hi %s"%(["%.4f"%v for v in lo],["%.4f"%v for v in hi]))
print("  max per-strand arc-length change after transform: %.3e m"%err)
