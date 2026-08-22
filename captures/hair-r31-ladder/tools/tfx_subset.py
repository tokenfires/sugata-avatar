"""Writes a .tfx containing a SUBSET of another .tfx's strands.

Two selection modes, and the difference between them is the point of the exercise:
  --mode prefix      the first N strands, i.e. exactly what hairObject.getRenderedStrandCount()
                     does at a given lodRenderPercent (hairObject.ts:52-57)
  --mode stratified  a fixed-seed uniform random draw of N of the M strands, which preserves
                     the groom's spatial distribution and therefore its screen coverage

Strand SHAPE is never touched: whole 16-float-per-vertex records are copied verbatim.
"""
import struct, argparse, random

p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst'); p.add_argument('count', type=int)
p.add_argument('--mode', choices=['prefix', 'stratified'], default='stratified')
p.add_argument('--seed', type=int, default=20260822)
a = p.parse_args()

raw = open(a.src, 'rb').read()
ver, ns, nv, off = struct.unpack_from('<fIII', raw, 0)
assert a.count <= ns, f'{a.count} > {ns}'
stride = nv * 16

if a.mode == 'prefix':
    picks = list(range(a.count))
else:
    rng = random.Random(a.seed)
    picks = sorted(rng.sample(range(ns), a.count))

head = bytearray(raw[:off])
struct.pack_into('<I', head, 4, a.count)
body = b''.join(raw[off + i * stride: off + (i + 1) * stride] for i in picks)
open(a.dst, 'wb').write(bytes(head) + body)
print(f'{a.dst}  {a.mode}  {a.count} of {ns} strands  {len(head)+len(body)} bytes')
