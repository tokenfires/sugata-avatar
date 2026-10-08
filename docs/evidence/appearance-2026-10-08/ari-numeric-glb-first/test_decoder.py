"""Independent fixtures for striding, sparse overwrite, bounds and transform order."""
import copy
import json
import struct
import numpy as np
from glb_numeric import GLB, trs


def fixture(doc, payload):
    d = copy.deepcopy(doc)
    d.update(asset={"version": "2.0"}, buffers=[{"byteLength": len(payload)}],
             scenes=[{"nodes": [0]}], nodes=[{}], scene=0)
    j = json.dumps(d).encode()
    j += b" " * (-len(j) % 4)
    b = payload + bytes(-len(payload) % 4)
    total = 12 + 8+len(j) + 8+len(b)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<II", len(j), 0x4e4f534a) + j + struct.pack("<II", len(b), 0x004e4942) + b


checks = []
def passed(name, f):
    f()
    checks.append({"name": name, "pass": True})

def refused(name, f):
    try:
        f()
    except (RuntimeError, ValueError):
        checks.append({"name": name, "pass": True})
        return
    raise AssertionError("Malformed fixture accepted: " + name)

payload = bytes(4) + struct.pack("<4f", 1, 2, 3, 999) + struct.pack("<4f", 4, 5, 6, 888)
doc = {"bufferViews": [{"buffer": 0, "byteOffset": 4, "byteLength": 32, "byteStride": 16}],
       "accessors": [{"bufferView": 0, "componentType": 5126, "type": "VEC3", "count": 2}]}
raw = fixture(doc, payload)
passed("strided_VEC3_skips_canaries", lambda: np.testing.assert_array_equal(GLB(raw).accessor(0), [[1,2,3],[4,5,6]]))
bad = copy.deepcopy(doc); bad["accessors"][0]["count"] = 3
refused("out_of_view_dense_count", lambda: GLB(fixture(bad, payload)).accessor(0))
bad = copy.deepcopy(doc); bad["accessors"][0]["byteOffset"] = 1
refused("unaligned_dense_offset", lambda: GLB(fixture(bad, payload)).accessor(0))
refused("wrong_total_header_size", lambda: GLB(raw[:-1]))
payload = bytes([1,0,0,0]) + struct.pack("<3f", 7,8,9)
doc = {"bufferViews": [{"buffer":0,"byteOffset":0,"byteLength":1}, {"buffer":0,"byteOffset":4,"byteLength":12}],
       "accessors": [{"componentType":5126,"type":"VEC3","count":3,"sparse":{"count":1,"indices":{"bufferView":0,"componentType":5121},"values":{"bufferView":1}}}]}
passed("sparse_zero_base_overwrite", lambda: np.testing.assert_array_equal(GLB(fixture(doc,payload)).accessor(0), [[0,0,0],[7,8,9],[0,0,0]]))
huge = copy.deepcopy(doc); huge["accessors"][0]["count"] = 1000000000
refused("huge_sparse_count_before_allocation", lambda: GLB(fixture(huge,payload)).accessor(0))
refused("aggregate_decoded_byte_budget", lambda: GLB(fixture(doc,payload),max_decoded_bytes=8).accessor(0))
refused("raw_GLB_byte_budget", lambda: GLB(fixture(doc,payload),max_glb_bytes=16))
refused("sparse_out_of_range", lambda: GLB(fixture(doc,bytes([3,0,0,0])+payload[4:])).accessor(0))
bad = copy.deepcopy(doc); bad["bufferViews"][0]["byteLength"] = 2; bad["bufferViews"][1]["byteLength"] = 24; bad["accessors"][0]["sparse"]["count"] = 2
refused("duplicate_sparse_indices", lambda: GLB(fixture(bad,bytes([1,1,0,0])+struct.pack("<6f",7,8,9,10,11,12))).accessor(0))
doc = {"bufferViews":[{"buffer":0,"byteLength":4}], "accessors":[{"bufferView":0,"componentType":5120,"type":"VEC4","count":1,"normalized":True}]}
passed("signed_normalization_negative_endpoint", lambda: np.testing.assert_allclose(GLB(fixture(doc,struct.pack("<4b",-128,-127,0,127))).accessor(0),[[-1,-1,0,1]],rtol=0,atol=0))
node = {"translation":[10,20,30],"rotation":[0,0,2**-.5,2**-.5],"scale":[2,3,4]}
passed("TRS_order_and_xyzw_quaternion", lambda: np.testing.assert_allclose(trs(node) @ [1,1,1,1], [7,22,34,1],atol=1e-12,rtol=0))
passed("column_major_translation_matrix", lambda: np.testing.assert_array_equal(trs({"matrix":[1,0,0,0,0,1,0,0,0,0,1,0,10,20,30,1]}) @ [0,0,0,1],[10,20,30,1]))
refused("nonunit_quaternion", lambda: trs({"rotation":[0,0,0,2]}))
refused("nonfinite_node", lambda: trs({"translation":[float("nan"),0,0]}))
print(json.dumps({"checks":checks,"passed":all(c["pass"] for c in checks)},indent=2))
