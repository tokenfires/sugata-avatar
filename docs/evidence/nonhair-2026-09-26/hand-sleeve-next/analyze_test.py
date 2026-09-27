import unittest,copy,json,gzip
from analyze import *
class AdmissionTests(unittest.TestCase):
    def test_source_selector_includes_small_support_and_mixed_faces(self):
        s={'jointNames':['upperarm_l','lowerarm_l','head'], 'JOINTS_0':[[0,1,2,2]]*4,
           'WEIGHTS_0':[[0,0,1,0],[1e-30,0,1,0],[0,0,1,0],[0,.1,.9,0]],'indices':[0,1,2,0,2,3,0,2,0]}
        ids,weights=arm_selection(s,'l');self.assertEqual(ids,[0,1]);self.assertEqual(weights[1],1e-30)
        s['WEIGHTS_0'][1][0]=0;s['WEIGHTS_0'][3][1]=0;self.assertEqual(arm_selection(s,'l')[0],[])
        s['jointNames'][0]='clavicle_l'
        with self.assertRaisesRegex(ValueError,'Required'):arm_selection(s,'l')
    def test_broadphase_matches_bruteforce_inclusive_boundaries(self):
        boxes=[{'min':(x,-1,-1),'max':(x+1,1,1)} for x in [-2,-1,0,1,2]];ix=Index(boxes)
        for x in [-2,-1,0,math.nextafter(0,-math.inf),math.nextafter(0,math.inf),1,2]:
            q={'min':(x,1,1),'max':(x,1,1)};self.assertEqual(ix.query(q),[b for b in boxes if overlap(q,b)])
    def test_actual_corrupt_full_and_drawn_ids(self):
        p='captures/hand-candidate-2026-09-26/candidate-dense-v2/meshes-593.json.gz';s=json.loads(gzip.decompress(read(p)))
        sources={m['id']:glb(read(ASSETS[m['id']]),len(m['positions'])//3) for m in s['meshes']}
        bad=copy.deepcopy(s);bad['meshes'][0]['fullIndices'][0]+=1
        with self.assertRaisesRegex(ValueError,'source topology'):meshes_of(bad,sources)
        bad=copy.deepcopy(s);bad['meshes'][0]['drawnIndices'][0]=len(sources['body']['POSITION'])+1
        with self.assertRaisesRegex(ValueError,'drawn membership'):meshes_of(bad,sources)
    def test_mask_does_not_remove_targets(self):
        def t(ps,ids,mesh):return {'points':ps,'ids':ids,'mesh':mesh,'face':0,'drawn':False,'min':tuple(min(p[k] for p in ps) for k in range(3)),'max':tuple(max(p[k] for p in ps) for k in range(3))}
        a=t(((0,0,0),(2,0,0),(0,2,0)),(0,1,2),'body');b=t(((.5,-1,-1),(.5,3,-1),(.5,1,1)),(0,1,2),'garment')
        r=compare([a],[b]);self.assertEqual(r['counts']['transverse-interior'],1);self.assertEqual(r['counts']['oneOrBothMasked'],1)
        self.assertEqual(compare([a],[])['findings'],[])
if __name__=='__main__':unittest.main()
