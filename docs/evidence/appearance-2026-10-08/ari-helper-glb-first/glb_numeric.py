"""Strict, bounded decoder for this diagnostic's GLB/accessor/TRS subset."""
import json
import struct
import numpy as np


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def finite(value, label):
    require(np.isfinite(value).all(), "Nonfinite " + label)
    return value


def trs(node):
    if "matrix" in node:
        require(not any(k in node for k in ("translation", "rotation", "scale")), "Matrix with TRS")
        a = np.asarray(node["matrix"], dtype=np.float64)
        require(a.shape == (16,), "Invalid matrix arity")
        m = a.reshape(4, 4).T
    else:
        t = finite(np.asarray(node.get("translation", [0, 0, 0]), dtype=np.float64), "translation")
        q = finite(np.asarray(node.get("rotation", [0, 0, 0, 1]), dtype=np.float64), "rotation")
        s = finite(np.asarray(node.get("scale", [1, 1, 1]), dtype=np.float64), "scale")
        require(t.shape == (3,) and q.shape == (4,) and s.shape == (3,), "TRS arity")
        require(abs(np.linalg.norm(q) - 1) <= 1e-6, "Nonunit quaternion")
        x, y, z, w = q
        m = np.eye(4)
        m[:3, :3] = np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]) @ np.diag(s)
        m[:3, 3] = t
    finite(m, "node matrix")
    require(np.max(np.abs(m[3] - [0, 0, 0, 1])) <= 1e-6, "Nonaffine matrix")
    return m


class GLB:
    DTYPES = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
    WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    def __init__(self, raw, *, max_accessor_rows=250000, max_decoded_bytes=512*1024**2,
                 max_glb_bytes=256*1024**2):
        require(all(type(n) is int and n > 0 for n in (max_accessor_rows,max_decoded_bytes,max_glb_bytes)), "Decoder budgets")
        require(len(raw) <= max_glb_bytes, "GLB byte budget")
        self.max_accessor_rows = max_accessor_rows
        self.max_decoded_bytes = max_decoded_bytes
        self.decoded_bytes = 0
        require(len(raw) >= 20, "Short GLB")
        magic, version, length = struct.unpack_from("<4sII", raw)
        require(magic == b"glTF" and version == 2 and length == len(raw), "GLB header")
        chunks, pos = [], 12
        while pos < len(raw):
            require(pos + 8 <= len(raw), "Short chunk header")
            n, kind = struct.unpack_from("<II", raw, pos)
            require(n % 4 == 0 and pos + 8 + n <= len(raw), "Chunk length/alignment")
            chunks.append((kind, raw[pos+8:pos+8+n]))
            pos += 8+n
        require(len(chunks) == 2 and chunks[0][0] == 0x4e4f534a and chunks[1][0] == 0x004e4942,
                "Require exactly JSON then BIN")
        self.original_bytes = raw
        self.doc = json.loads(chunks[0][1].decode("utf-8"))
        require(self.doc.get("asset", {}).get("version") == "2.0", "Asset version")
        require(not self.doc.get("extensionsRequired"), "Required extension outside numeric subset")
        buffers = self.doc.get("buffers", [])
        require(len(buffers) == 1 and "uri" not in buffers[0], "External/multiple buffer")
        size = buffers[0]["byteLength"]
        require(type(size) is int and 0 < size <= len(chunks[1][1]) <= size+3, "BIN declared size")
        require(not any(chunks[1][1][size:]), "Nonzero BIN padding")
        self.bin = chunks[1][1][:size]
        self.cache = {}
        self.parent = {}
        nodes = self.doc.get("nodes", [])
        for i, node in enumerate(nodes):
            children = node.get("children", [])
            require(len(set(children)) == len(children), "Duplicate child")
            for child in children:
                require(type(child) is int and 0 <= child < len(nodes) and child not in self.parent,
                        "Child index/multiple parent")
                self.parent[child] = i
        self.worlds = {}
        for i in range(len(nodes)):
            self.world(i, set())
        scene = self.doc.get("scene", 0)
        require(type(scene) is int and 0 <= scene < len(self.doc.get("scenes", [])), "Scene index")
        roots = self.doc["scenes"][scene].get("nodes", [])
        require(len(roots) == len(set(roots)), "Duplicate scene root")
        for i in roots:
            require(type(i) is int and 0 <= i < len(nodes) and i not in self.parent, "Scene root")
        self.reachable = set()
        def walk(i):
            require(i not in self.reachable, "Repeated scene node")
            self.reachable.add(i)
            for child in nodes[i].get("children", []):
                walk(child)
        for i in roots:
            walk(i)

    def world(self, i, visiting):
        if i in self.worlds:
            return self.worlds[i]
        require(i not in visiting, "Hierarchy cycle")
        visiting.add(i)
        local = trs(self.doc["nodes"][i])
        result = self.world(self.parent[i], visiting) @ local if i in self.parent else local
        visiting.remove(i)
        self.worlds[i] = finite(result, "global matrix")
        return result

    def array(self, view_index, offset, count, width, dtype, allow_stride=True):
        views = self.doc.get("bufferViews", [])
        require(type(view_index) is int and 0 <= view_index < len(views), "BufferView index")
        v = views[view_index]
        require(v.get("buffer") == 0 and not v.get("extensions"), "BufferView buffer/extension")
        start, length = v.get("byteOffset", 0), v["byteLength"]
        dt = np.dtype(dtype)
        packed = width * dt.itemsize
        stride = v.get("byteStride", packed)
        require(all(type(x) is int for x in (start, length, offset, count, stride)), "Integer buffer dimensions")
        require(start >= 0 and length >= 0 and start+length <= len(self.bin), "BufferView bounds")
        require(count > 0 and offset >= 0 and (start+offset) % dt.itemsize == 0, "Accessor count/alignment")
        require(stride >= packed and stride % dt.itemsize == 0, "Accessor stride")
        if "byteStride" in v:
            require(allow_stride and 4 <= stride <= 252 and stride % 4 == 0, "Unsupported stride")
        require(offset+(count-1)*stride+packed <= length, "Accessor view bounds")
        return np.ndarray((count, width), dtype=dt, buffer=self.bin, offset=start+offset,
                          strides=(stride, dt.itemsize)).copy()

    def accessor(self, index):
        require(type(index) is int and 0 <= index < len(self.doc.get("accessors", [])), "Accessor index")
        if index in self.cache:
            return self.cache[index]
        a = self.doc["accessors"][index]
        require(not a.get("extensions"), "Accessor extension")
        component, kind, count = a["componentType"], a["type"], a["count"]
        require(component in self.DTYPES and kind in self.WIDTHS and type(count) is int and count > 0,
                "Accessor type/count")
        require(count <= self.max_accessor_rows, "Accessor row budget")
        require(kind != "MAT4" or component == 5126, "Only FLOAT MAT4 supported")
        width, dtype = self.WIDTHS[kind], self.DTYPES[component]
        bytes_needed = count*width*(8 if a.get("normalized",False) else np.dtype(dtype).itemsize)
        require(self.decoded_bytes+bytes_needed <= self.max_decoded_bytes, "Decoded accessor byte budget")
        self.decoded_bytes += bytes_needed
        if "bufferView" in a:
            out = self.array(a["bufferView"], a.get("byteOffset", 0), count, width, dtype)
        else:
            require("sparse" in a and a.get("byteOffset", 0) == 0, "Missing accessor storage")
            out = np.zeros((count, width), dtype=dtype)
        if "sparse" in a:
            s = a["sparse"]
            n, inds, vals = s["count"], s["indices"], s["values"]
            require(type(n) is int and 0 < n <= count, "Sparse count")
            it = inds["componentType"]
            require(it in (5121, 5123, 5125), "Sparse index type")
            ix = self.array(inds["bufferView"], inds.get("byteOffset", 0), n, 1, self.DTYPES[it], False)[:, 0]
            require((ix < count).all() and (np.diff(ix.astype(np.int64)) > 0).all(), "Sparse order/range")
            out[ix] = self.array(vals["bufferView"], vals.get("byteOffset", 0), n, width, dtype, False)
        if a.get("normalized", False):
            require(component in (5120, 5121, 5122, 5123), "Unsupported normalized component")
            lim = np.iinfo(np.dtype(dtype)).max
            out = out.astype(np.float64) / lim
            if component in (5120, 5122):
                out = np.maximum(out, -1)
        finite(out, "accessor")
        self.cache[index] = out
        return out
