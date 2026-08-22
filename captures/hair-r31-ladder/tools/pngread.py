"""Minimal 8-bit PNG decoder -> numpy (H,W,C). Paeth/avg rows are done per-row in numpy where
the filter allows it; Sub/Paeth need a per-pixel left dependency so those rows fall back to a
python loop. Good enough for a handful of 720x900 plates."""
import zlib, struct
import numpy as np

def readpng(path):
    d = open(path,'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i = 8; idat = b''; w = h = bd = ct = None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; data = d[i+8:i+8+ln]
        if typ == b'IHDR': w,h,bd,ct = struct.unpack('>IIBB', data[:10])
        elif typ == b'IDAT': idat += data
        i += 12 + ln
    assert bd == 8, bd
    nch = {0:1, 2:3, 4:2, 6:4}[ct]
    raw = zlib.decompress(idat)
    stride = w * nch
    out = np.zeros((h, stride), dtype=np.uint8)
    prev = np.zeros(stride, dtype=np.int32)
    pos = 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = np.frombuffer(raw[pos:pos+stride], dtype=np.uint8).astype(np.int32).copy(); pos += stride
        if f == 0:
            cur = line
        elif f == 2:
            cur = (line + prev) & 255
        else:
            cur = line
            for x in range(stride):
                a = cur[x-nch] if x >= nch else 0
                b = prev[x]
                c = prev[x-nch] if x >= nch else 0
                if f == 1: cur[x] = (cur[x] + a) & 255
                elif f == 3: cur[x] = (cur[x] + ((a + b) >> 1)) & 255
                else:
                    p = a + b - c
                    pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                    pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                    cur[x] = (cur[x] + pr) & 255
        out[y] = cur.astype(np.uint8)
        prev = cur.astype(np.int32)
    return out.reshape(h, w, nch)
