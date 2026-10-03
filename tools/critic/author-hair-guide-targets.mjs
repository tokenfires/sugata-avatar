/** One literal artistic six-sheet target. No GLB writer, fit, asset or runtime mutation. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='docs/evidence/appearance-2026-10-02/front-design/guide-targets-v1.json',started=new Date().toISOString();
assert.ok(!fs.existsSync(out),'Preserve one proposal; no retry');
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={started,pid:process.pid,status:'authoring',sourceHashes:{},orientations:{},checks:[],completedStages:[],limits:['Independent artist sheet targets, not a constructed groom or complete hair volume.','Off-surface points follow head44 skin matrix only, with no body morph displacement or barycentric extrapolation.','No editable158assignment/interpolation, protected338feasibility, physicalvisibility, fit or motion acceptance.']};
const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a));
const spec=[
 {role:'dominant-inner-sweep',points:[[-.013,1.678,.080],[.062,1.665,.145],[.124,1.535,.150],[.074,1.467,.105]],width:.026,hint:[0,0,1]},
 {role:'dominant-outer-side',points:[[-.018,1.681,.049],[.104,1.670,.077],[.137,1.523,.066],[.089,1.458,.050]],width:.032,hint:[1,0,0]},
 {role:'dominant-crown-return',points:[[-.017,1.673,.011],[.105,1.660,-.028],[.139,1.530,-.052],[.090,1.465,-.015]],width:.030,hint:[1,0,-1]},
 {role:'minor-inner-framing',points:[[-.025,1.674,.071],[-.088,1.655,.122],[-.118,1.546,.102],[-.080,1.482,.075]],width:.021,hint:[0,0,1]},
 {role:'minor-outer-side',points:[[-.029,1.677,.046],[-.109,1.660,.053],[-.132,1.536,.025],[-.080,1.468,.022]],width:.025,hint:[-1,0,0]},
 {role:'minor-crown-return',points:[[-.026,1.667,.009],[-.098,1.649,-.035],[-.126,1.540,-.055],[-.080,1.478,-.015]],width:.027,hint:[-1,0,-1]}
];
const coordinateBounds=[[-.18,.18],[1.42,1.71],[-.12,.19]];
const curve=(p,t)=>p[0].map((_,c)=>(1-t)**3*p[0][c]+3*(1-t)**2*t*p[1][c]+3*(1-t)*t*t*p[2][c]+t**3*p[3][c]);
const derivative=(p,t)=>p[0].map((_,c)=>3*((1-t)**2*(p[1][c]-p[0][c])+2*(1-t)*t*(p[2][c]-p[1][c])+t*t*(p[3][c]-p[2][c])));
function arc(points,n){let sum=0;for(let i=0;i<=n;i++)sum+=(i===0||i===n?1:i%2?4:2)*norm(derivative(points,i/n));return sum/(3*n);}
function sample(s,t){const centre=curve(s.points,t),d=derivative(s.points,t),T=unit(d),projected=s.hint.map((v,i)=>v-T[i]*dot(s.hint,T)),N=unit(projected),U=cross(N,T);
 report.currentSample={role:s.role,t,centre,derivative:d,derivativeMagnitude:norm(d),projectedHintMagnitude:norm(projected)};
 assert.ok(norm(d)>1e-9&&norm(projected)>1e-4,'Stop undefined/singular frame');
 const axes=[T,U,N];for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs(dot(axes[a],axes[b])-(a===b?1:0))<1e-10);
 assert.ok(norm(cross(T,U).map((v,i)=>v-N[i]))<1e-10);
 const minus=centre.map((v,i)=>v-s.width/2*U[i]),plus=centre.map((v,i)=>v+s.width/2*U[i]);
 for(const p of [centre,minus,plus])for(let c=0;c<3;c++)assert.ok(p[c]>=coordinateBounds[c][0]&&p[c]<=coordinateBounds[c][1]);
 return{t,centre,T,U,N,minus,plus,derivativeMagnitude:norm(d),projectedHintMagnitude:norm(projected)};
}
try{
 assert.ok(Date.now()<Date.parse('2026-10-03T06:50:00Z'));
 const pins={'assets/figures/figure_g050.glb':'b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14','captures/hair-boundary-2026-10-02-v1/report.json':'3a9d2349ae7fe0ea315eb2888c9ef3fec993396da3bc4d93fe951f9a6745cc0f',
 'reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg':'ab887b08609fbf4cae831fed3687a78c0d04a04ddcfacd2b57a791201223079e','reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg':'5898a1b61be9400ecaacd8252f7d53516500d5f95af694219b15ff2c78c1961c','docs/evidence/appearance-2026-10-02/front-design/concept-v1.png':'568ee8125a82da00f24bca35cbe4953ece5cda0a053dd638e68898da88ca3503'};
 for(const[p,h]of Object.entries(pins)){assert.equal(sha(p),h,p);report.sourceHashes[p]=h;}
 for(const p of ['tools/critic/author-hair-guide-targets.mjs','docs/evidence/appearance-2026-10-02/front-design/GUIDE-TARGET-PLAN.md','docs/evidence/appearance-2026-10-02/front-design/GUIDE-TARGET-VALUE-CRITIQUE.md','docs/evidence/appearance-2026-10-02/front-design/GUIDE-TARGET-VALUE-DECISION.md'])report.sourceHashes[p]=sha(p);
 const native=JSON.parse(fs.readFileSync('captures/hair-boundary-2026-10-02-v1/report.json'));assert.equal(native.status,'captured');assert.equal(native.setup.state.bones[44].name,'head');
 for(const v of native.views)for(const p of [v.beauty]){const file='captures/hair-boundary-2026-10-02-v1/'+p.file;assert.equal(sha(file),p.sha256);report.sourceHashes[file]=p.sha256;}
 report.registration={bodyMesh:'base.001',boneIndex:44,boneName:'head',formula:'bodyWorld * bindInverse * headWorld * headInverseBind * bind * point',morphDisplacement:false,nativeReport:'captures/hair-boundary-2026-10-02-v1/report.json'};
 report.curveBasis='Single cubic BernsteinBezier; t0..1; uniform parameter samples, not arc parameterization';report.sheetDefinition='17centre/edge/frame records and16ruled spans;257smooth annotation samples, no thickness.';
 for(const[name,sign]of [['A',1],['B',-1]]){
  const guides=[];
  for(const base of spec){const s={...base,points:base.points.map(p=>[p[0]*sign,p[1],p[2]]),hint:unit([base.hint[0]*sign,base.hint[1],base.hint[2]])};
   report.current={orientation:name,role:s.role,stage:'analytic-bounds',points:s.points,width:s.width,hint:s.hint};
   const dControl=[0,1,2].map(i=>s.points[i].map((v,c)=>3*(s.points[i+1][c]-v))),lowerY=Math.min(...dControl.map(d=>-d[1])),upperSpeed=Math.max(...dControl.map(norm));
   Object.assign(report.current,{derivativeControl:dControl,lowerY,upperSpeed,projectedHintLowerBound:lowerY/upperSpeed});
   assert.ok(lowerY>1e-9&&lowerY/upperSpeed>1e-4,'Analytic derivative/frame bound');assert.equal(s.hint[1],0);assert.ok(s.width>=.015&&s.width<=.050);
   for(let c=0;c<3;c++){assert.ok(Math.min(...s.points.map(p=>p[c]))-s.width/2>=coordinateBounds[c][0]);assert.ok(Math.max(...s.points.map(p=>p[c]))+s.width/2<=coordinateBounds[c][1]);}
   report.completedStages.push({orientation:name,role:s.role,stage:'analytic-and-extent-bounds'});
   report.current.stage='sampled-frames';const records=Array.from({length:17},(_,i)=>sample(s,i/16)),annotation=Array.from({length:257},(_,i)=>sample(s,i/256));
   report.completedStages.push({orientation:name,role:s.role,stage:'sampled-frames',samples:274});
   const n4096=arc(s.points,4096),n8192=arc(s.points,8192),polygon=records.slice(1).reduce((sum,r,i)=>sum+norm(r.centre.map((v,c)=>v-records[i].centre[c])),0);
   report.current.stage='arc-bounds';report.current.arcMetrics={n4096,n8192,polygon,polygonDeficit:n8192-polygon};
   assert.ok(Math.abs(n4096-n8192)<=1e-6&&n8192>=.15&&n8192<=.35&&n8192-polygon>=-1e-12&&n8192-polygon<=.002);
   report.completedStages.push({orientation:name,role:s.role,stage:'arc-bounds',...report.current.arcMetrics});
   guides.push({...s,semanticControls:['artist-root','first-turn-control','side/end-approach-control','artist-tip'],continuousDerivativeLowerBound:lowerY,projectedHintLowerBound:lowerY/upperSpeed,arc:{method:'CompositeSimpson numerical estimates; not certified integral',intervals:[4096,8192],estimates:[n4096,n8192],agreement:Math.abs(n4096-n8192),polygon17:polygon,polygonDeficit:n8192-polygon},records,annotation});
  }
  report.orientations[name]={semantics:`Dominant ${sign===1?'positive':'negative'}X, minor complementary; part ${sign===1?'negative':'positive'}X. Reflection of artist target, not symmetricbody claim.`,guides};
 }
 const reflect=(a)=>[-a[0],a[1],a[2]],error=(a,b)=>norm(a.map((v,i)=>v-b[i]));let mirrorMax=0;
 report.current={orientation:'A/B',stage:'mirror'};
 for(let g=0;g<6;g++)for(let i=0;i<257;i++){const a=report.orientations.A.guides[g].annotation[i],b=report.orientations.B.guides[g].annotation[i];for(const key of ['centre','T','N'])mirrorMax=Math.max(mirrorMax,error(reflect(a[key]),b[key]));mirrorMax=Math.max(mirrorMax,error(reflect(a.U).map(v=>-v),b.U),error(reflect(a.plus),b.minus),error(reflect(a.minus),b.plus));}
 assert.ok(mirrorMax<1e-12);report.mirrorMaximumResidual=mirrorMax;delete report.current;delete report.currentSample;
 for(const[p,h]of Object.entries(report.sourceHashes))assert.equal(sha(p),h,p);assert.ok(Date.now()<Date.parse('2026-10-03T06:50:00Z'));
 report.checks=['Exact input/source/native image hashes','6fixedcurves perorientation','Analytic monotonicY nonzero derivative and horizontalhint frame lowerbounds','Global controlhull+width extent bounds','17+257sample orthonormal frames/sheetbounds','Derived4096/8192arc agreement/limits and17sample deficit','Semanticmirror centre/frame/edgeparity','Explicit head44registration; no bodymorph/fit'];report.status='authored';
}catch(e){report.status='refused';report.error=e.stack;report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,status:report.status,pid:process.pid}));throw e;}
report.finished=new Date().toISOString();save();console.log(JSON.stringify({out,status:report.status,pid:process.pid,sha256:sha(out),arcs:report.orientations.A.guides.map(g=>({role:g.role,arc:g.arc.estimates[1],polygonDeficit:g.arc.polygonDeficit}))}));
