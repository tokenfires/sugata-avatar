import unittest
from exact_triangles import *
A=((0,0,0),(2,0,0),(0,2,0))
def tri(points,ids=(0,1,2),mesh='body'):return {'points':points,'ids':ids,'mesh':mesh}
class GeometryTests(unittest.TestCase):
    def test_crossing_without_contained_vertex(self):
        b=((.5,-1,-1),(.5,3,-1),(.5,1,1)); h=intersection(A,b)
        self.assertEqual(h['kind'],'transverse-interior'); self.assertEqual(len(h['points']),2)
        self.assertTrue(all(p[2]!=0 for p in b))
        mid=tuple(sum(p[i] for p in h['points'])/2 for i in range(3))
        self.assertTrue(all(x>0 for t in (A,b) for x in barycentric(mid,exact(t))))
    def test_disjoint_and_tiny_gap(self):
        for dz in (1,1e-300): self.assertIsNone(intersection(A,tuple((x,y,dz) for x,y,z in A)))
    def test_coplanar_and_winding(self):
        b=((.25,.25,0),(1,.25,0),(.25,1,0));h=intersection(A,b)
        self.assertEqual(h['kind'],'coplanar-area');self.assertEqual(set(h['points']),set(intersection(A,b[::-1])['points']))
    def test_shared_edge(self):
        b=((0,0,0),(2,0,0),(0,-2,0));h=intersection(A,b)
        self.assertEqual(h['kind'],'boundary-contact');self.assertTrue(shared_only(h,tri(A),tri(b,(0,1,3))))
    def test_shared_vertex_only(self):
        b=((0,0,0),(-1,0,1),(0,-1,1));h=intersection(A,b)
        self.assertTrue(shared_only(h,tri(A),tri(b,(0,3,4))))
    def test_beyond_shared_vertex_and_edge(self):
        b=((0,0,0),(1,1,-1),(1,1,1));h=intersection(A,b)
        self.assertFalse(shared_only(h,tri(A),tri(b,(0,3,4))))
        b=((0,0,0),(2,0,0),(1,1,0));h=intersection(A,b)
        self.assertEqual(h['kind'],'coplanar-area');self.assertFalse(shared_only(h,tri(A),tri(b,(0,1,4))))
    def test_cross_mesh_and_coincident_ids(self):
        b=((0,0,0),(2,0,0),(0,-2,0));h=intersection(A,b)
        self.assertFalse(shared_only(h,tri(A),tri(b,(0,1,3),'garment')))
        self.assertFalse(shared_only(h,tri(A),tri(b,(5,6,7))))
    def test_fail_closed(self):
        for b in [((0,0,0),(1,0,0),(2,0,0)),((0,0,0),(1,0,0),(0,float('nan'),0))]:
            with self.assertRaises(ValueError): intersection(A,b)
    def test_endpoint_touch_and_symmetry(self):
        b=((2,0,0),(3,0,1),(3,1,0));h=intersection(A,b)
        self.assertEqual(h['points'],[(F(2),F(0),F(0))]);self.assertEqual(h['kind'],'boundary-contact')
        self.assertEqual(set(h['points']),set(intersection(b,A)['points']))
if __name__=='__main__':unittest.main()
