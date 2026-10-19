import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url)),started=performance.now(),startedUTC=new Date().toISOString();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const requireThat=(ok,msg)=>{if(!ok)throw Error(msg);};
const admissionRaw=fs.readFileSync(path.join(root,'CPU-ADMISSION.json'));
requireThat(process.argv.length===3&&process.argv[2]===sha(admissionRaw),'exact admission argument required');
const admission=JSON.parse(admissionRaw);
requireThat(Date.now()<Date.parse(admission.expires_utc)&&Date.now()<Date.parse(admission.absolute_deadline_utc),'admission expired');
for(const row of admission.pins){const b=fs.readFileSync(row.path);requireThat(b.length===row.bytes&&sha(b)===row.sha256,`pin mismatch:${row.path}`);}
for(const name of ['model.json','model.obj','model.mtl','CPU-RESULT.json'])requireThat(!fs.existsSync(path.join(root,name)),`output already exists:${name}`);
const d=JSON.parse(fs.readFileSync(path.join(root,'design.json'),'utf8')),N=d.resolution.ring,parts=[];
const timed=()=>requireThat(performance.now()-started<d.limits.checkElapsedMs,'checked elapsed limit');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);requireThat(n>1e-12,'zero direction');return scale(a,1/n);};
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t),clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const rounded=v=>Math.round(v*1e9)/1e9;
function piece(name,genus=0){
  const p={name,genus,positions:[],faces:[],weld:new Map()};
  p.v=q=>{q=q.map(rounded);const key=q.join(',');if(p.weld.has(key))return p.weld.get(key);const i=p.positions.length;p.positions.push(q);p.weld.set(key,i);return i;};
  p.f=(v,material)=>p.faces.push({v,material});parts.push(p);return p;
}
const quad=(p,a,b,c,e,m)=>p.f([a,b,c,e],m);
function ring(p,points){return points.map(q=>p.v(q));}
function bridge(p,a,b,m){requireThat(a.length===b.length,'ring mismatch');for(let i=0;i<a.length;i++){const j=(i+1)%a.length;quad(p,a[i],a[j],b[j],b[i],m);}}
function disk(p,a,centre,m){const c=p.v(centre);for(let i=0;i<a.length;i++)p.f([c,a[i],a[(i+1)%a.length]],m);}
function outline(t){
  const o=d.outline,s=Math.sin(t),c=Math.cos(t),z=o.halfLength*Math.sign(c)*Math.abs(c)**o.cosExponent;
  let w=o.heelHalfWidth+o.forefootAdditionalWidth*Math.exp(-(((z-o.forefootCentreZ)/o.forefootSpread)**2));
  if(s<0)w=w*o.medialWidthFactor-o.medialArchInset*Math.exp(-(((z-o.archCentreZ)/o.archSpread)**2));
  return [Math.sign(s)*Math.abs(s)**o.sinExponent*w,z];
}
const entryWidth=z=>d.entry.halfWidth*Math.sqrt(Math.max(0,1-((z-d.entry.centreZ)/d.entry.halfLength)**2));
const entryY=z=>d.entry.backHeight-d.entry.frontDrop*clamp((z-d.entry.centreZ)/d.entry.halfLength);
const base=Array.from({length:N},(_,i)=>outline(2*Math.PI*i/N));
function slab(name,loop,y0,y1,material){
  const p=piece(name),a=ring(p,loop.map(([x,z])=>[x,y0,z])),b=ring(p,loop.map(([x,z])=>[x,y1,z]));
  bridge(p,a,b,material);disk(p,a,[0,y0,0],material);disk(p,b,[0,y1,0],material);return p;
}
slab('contact-edge',base,d.sole.contactY,d.sole.edgeTopY,'contact');
slab('unstriped-sidewall',base,d.sole.edgeTopY,d.sole.topY,'sole');
const bedLoop=base.map(([x,z])=>[x*d.entry.liningXFactor,z*d.entry.liningZFactor]);
slab('footbed',bedLoop,d.sole.footbedY-d.sole.footbedThickness,d.sole.footbedY,'footbed');

// Closed wall around the open entry: exterior, real interior, collar return and lower join.
const upper=piece('upper-and-lining',1),outside=[],inside=[];
for(let k=0;k<=d.resolution.upperSteps;k++){
  timed();const v=k/d.resolution.upperSteps,outerPoints=[],innerPoints=[];
  for(let i=0;i<N;i++){
    const t=2*Math.PI*i/N,[bx,bz]=base[i],ex=d.entry.halfWidth*Math.sin(t),ez=d.entry.centreZ+d.entry.halfLength*Math.cos(t);
    const x=bx*(1-v)+ex*v,z=bz*(1-v)+ez*v;
    const y=d.sole.topY+(entryY(ez)-d.sole.topY)*v**1.2+0.025*Math.sin(Math.PI*v)*Math.max(Math.cos(t),0);
    outerPoints.push([x,y,z]);innerPoints.push([x*d.entry.liningXFactor,y+0.015*(1-v)-d.entry.liningTopDrop*v,z*d.entry.liningZFactor]);
  }
  outside.push(ring(upper,outerPoints));inside.push(ring(upper,innerPoints));
}
for(let k=0;k<outside.length-1;k++){bridge(upper,outside[k],outside[k+1],'upper');bridge(upper,inside[k],inside[k+1],'lining');}
bridge(upper,outside.at(-1),inside.at(-1),'lining');bridge(upper,outside[0],inside[0],'upper');

// A closed padded tongue, with an exposed raised rear tip and a low front under the guides.
const tongueLoop=Array.from({length:48},(_,i)=>{
  const t=i/48*Math.PI*2,c=Math.cos(t),s=Math.sin(t),z=(d.tongue.frontZ+d.tongue.rearZ)/2+(d.tongue.frontZ-d.tongue.rearZ)/2*Math.sign(c)*Math.abs(c)**0.5;
  return [d.tongue.halfWidth*Math.sign(s)*Math.abs(s)**0.4,z];
});
const tongue=piece('padded-tongue');
const tongueHeight=z=>entryY(z)-d.tongue.underGuideDrop+d.tongue.rearRise*smooth((-z-0.36)/0.29);
const tongueBottom=ring(tongue,tongueLoop.map(([x,z])=>[x,tongueHeight(z)-d.tongue.padding,z]));
const tongueTop=ring(tongue,tongueLoop.map(([x,z])=>[x,tongueHeight(z),z]));
bridge(tongue,tongueBottom,tongueTop,'upper');disk(tongue,tongueBottom,[0,tongueHeight(0.1)-d.tongue.padding,0.1],'lining');disk(tongue,tongueTop,[0,tongueHeight(0.1)+0.012,0.1],'upper');

// Closed perforated stays: five welded rectangular cells per side, with actual open guide tunnels.
const holeRect=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const stayPoint=(side,u,z,yOffset)=>[side*(entryWidth(z)+u),entryY(z)+yOffset,z];
for(const side of [-1,1]){
  const p=piece(side<0?'medial-perforated-stay':'lateral-perforated-stay',5);
  for(let row=0;row<5;row++){
    const z0=d.laces.rowZ[row],u0=(d.laces.stayInnerU+d.laces.stayOuterU)/2,hw=(d.laces.stayOuterU-d.laces.stayInnerU)/2;
    const rect=holeRect.map(([u,z])=>[u0+u*hw,z0+z*0.1]);
    const hole=Array.from({length:8},(_,i)=>[d.laces.guideU+d.laces.holeRadius*Math.cos(i*Math.PI/4),z0+d.laces.holeRadius*Math.sin(i*Math.PI/4)]);
    const a=ring(p,rect.map(([u,z])=>stayPoint(side,u,z,0.02))),b=ring(p,hole.map(([u,z])=>stayPoint(side,u,z,0.02)));
    const undersideOffset=u=>0.02-d.laces.stayThickness-0.06*clamp((u-(d.laces.guideU+d.laces.holeRadius))/(d.laces.stayOuterU-(d.laces.guideU+d.laces.holeRadius)));
    const c=ring(p,rect.map(([u,z])=>stayPoint(side,u,z,undersideOffset(u)))),e=ring(p,hole.map(([u,z])=>stayPoint(side,u,z,undersideOffset(u))));
    bridge(p,a,b,'upper');bridge(p,c,e,'upper');bridge(p,b,e,'guide');
    for(let i=0;i<8;i++){
      const internalFront=row>0&&(i===1||i===2),internalRear=row<4&&(i===5||i===6);if(internalFront||internalRear)continue;
      const j=(i+1)%8;quad(p,a[i],a[j],c[j],c[i],'upper');
    }
  }
}

// Thin metallic rims follow the same throat coordinates as the ten real stay holes.
for(const side of [-1,1])for(let row=0;row<5;row++){
  const p=piece(`${side<0?'medial':'lateral'}-guide-${row+1}`,1),rings=[];
  for(let i=0;i<d.resolution.guideMajor;i++){
    const a=i/d.resolution.guideMajor*Math.PI*2;
    rings.push(ring(p,Array.from({length:d.resolution.guideMinor},(_,j)=>{
      const b=j/d.resolution.guideMinor*Math.PI*2,r=d.laces.holeRadius+d.laces.guideMinorRadius*Math.cos(b);
      return stayPoint(side,d.laces.guideU+r*Math.cos(a),d.laces.rowZ[row]+r*Math.sin(a),0.021+d.laces.guideMinorRadius*Math.sin(b));
    })));
  }
  for(let i=0;i<rings.length;i++)bridge(p,rings[i],rings[(i+1)%rings.length],'guide');
}

function tube(name,points,radius,material,sides=8){
  const p=piece(name),rings=[];let normal;
  for(let i=0;i<points.length;i++){
    const tangent=norm(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));
    let n=normal?sub(normal,scale(tangent,dot(normal,tangent))):cross(tangent,Math.abs(tangent[1])<0.9?[0,1,0]:[0,0,1]);
    if(Math.hypot(...n)<1e-8)n=cross(tangent,Math.abs(tangent[1])<0.9?[0,1,0]:[0,0,1]);
    normal=norm(n);const b=cross(tangent,normal);
    const vertices=Array.from({length:sides},(_,j)=>{
      const angle=j*2*Math.PI/sides;
      return add(points[i],add(scale(normal,radius*Math.cos(angle)),scale(b,radius*Math.sin(angle))));
    });
    rings.push(ring(p,vertices));
  }
  for(let i=0;i<rings.length-1;i++)bridge(p,rings[i],rings[i+1],material);
  disk(p,rings[0],points[0],material);disk(p,rings.at(-1),points.at(-1),material);return p;
}
// One continuous open-ended cord: alternating above/below spans pass through all ten guides.
const ports=[[-1,4],[1,3],[-1,2],[1,1],[-1,0],[1,0],[-1,1],[1,2],[-1,3],[1,4]];
const port=(side,row,above)=>stayPoint(side,d.laces.guideU,d.laces.rowZ[row],above?d.laces.aboveOffset:d.laces.belowOffset);
const lacePath=[];const append=q=>{if(!lacePath.length||Math.hypot(...sub(q,lacePath.at(-1)))>1e-8)lacePath.push(q);};
append(add(port(-1,4,true),[-0.035,0.035,-0.11]));
for(let k=0;k<ports.length;k++){
  const [side,row]=ports[k],arriveAbove=k%2===0,a=port(side,row,arriveAbove),b=port(side,row,!arriveAbove);
  append(a);append(mix(a,b,0.5));append(b);
  if(k<ports.length-1){
    const [nextSide,nextRow]=ports[k+1],c=port(nextSide,nextRow,!arriveAbove);
    for(let s=1;s<=12;s++){const t=s/12,q=mix(b,c,t);q[1]+=(side<0?0.026:-0.004)*Math.sin(Math.PI*t);append(q);}
  }
}
append(add(port(1,4,true),[0.035,0.035,-0.11]));tube('continuous-five-pair-lace',lacePath,d.laces.cordRadius,'lace',d.resolution.tubeSides);

// Closed original counter patch on the rear shell, not a flat painted silhouette.
const counter=piece('heel-counter'),patchOuter=[],patchInner=[];
for(const v of [0.12,0.78]){
  const a=[],b=[];
  for(let j=0;j<=16;j++){
    const t=Math.PI-0.65+j/16*1.3,[bx,bz]=outline(t),ex=d.entry.halfWidth*Math.sin(t),ez=d.entry.centreZ+d.entry.halfLength*Math.cos(t);
    const x=bx*(1-v)+ex*v,z=bz*(1-v)+ez*v,y=d.sole.topY+(entryY(ez)-d.sole.topY)*v**1.2;
    a.push(counter.v([x*1.025,y,z-0.012]));b.push(counter.v([x*0.985,y,z+0.003]));
  }
  patchOuter.push(a);patchInner.push(b);
}
for(let j=0;j<16;j++){quad(counter,patchOuter[0][j],patchOuter[0][j+1],patchOuter[1][j+1],patchOuter[1][j],'upper');quad(counter,patchInner[0][j],patchInner[0][j+1],patchInner[1][j+1],patchInner[1][j],'upper');}
for(let j=0;j<16;j++){quad(counter,patchOuter[0][j],patchOuter[0][j+1],patchInner[0][j+1],patchInner[0][j],'upper');quad(counter,patchOuter[1][j],patchOuter[1][j+1],patchInner[1][j+1],patchInner[1][j],'upper');}
quad(counter,patchOuter[0][0],patchOuter[1][0],patchInner[1][0],patchInner[0][0],'upper');quad(counter,patchOuter[0][16],patchOuter[1][16],patchInner[1][16],patchInner[0][16],'upper');
const backSeam=Array.from({length:9},(_,j)=>{const v=0.16+j/8*0.56;return [0,d.sole.topY+(entryY(-1.35)-d.sole.topY)*v**1.2,-1.5*(1-v)-1.35*v-0.016];});tube('central-back-join',backSeam,0.007,'seam',6);

// Original shallow underside marks are separate closed surface-detail volumes, not tested tread.
for(const [k,z0] of [1.0,0.68,0.36,-0.88,-1.1].entries()){
  const w=z0>0?0.30:0.20,points=Array.from({length:13},(_,j)=>{const x=-w+2*w*j/12;return [x,-0.004,z0+0.07*(1-(x/w)**2)];});
  tube(`underside-mark-${k+1}`,points,0.006,'contact',6);
}

// Validate and consistently orient each declared closed connected component before any output.
function qualify(p){
  timed();const faces=p.faces.map(f=>({v:[...f.v],material:f.material})),edges=new Map(),adj=faces.map(()=>[]);
  for(let f=0;f<faces.length;f++){
    const vs=faces[f].v;requireThat(new Set(vs).size===vs.length,'repeated face index');
    for(let i=0;i<vs.length;i++){const a=vs[i],b=vs[(i+1)%vs.length],key=[Math.min(a,b),Math.max(a,b)].join(':');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({f,direction:a<b?1:-1});}
  }
  for(const rows of edges.values()){requireThat(rows.length===2,`${p.name}:closed edge degree`);const [a,b]=rows;adj[a.f].push([b.f,a.direction===b.direction]);adj[b.f].push([a.f,a.direction===b.direction]);}
  const flipped=new Map([[0,false]]),queue=[0];
  for(let q=0;q<queue.length;q++){const f=queue[q];for(const [g,different] of adj[f]){const wanted=flipped.get(f)!==different;if(flipped.has(g))requireThat(flipped.get(g)===wanted,'nonorientable');else{flipped.set(g,wanted);queue.push(g);}}}
  requireThat(queue.length===faces.length,`${p.name}:one connected component`);
  for(let f=0;f<faces.length;f++)if(flipped.get(f))faces[f].v.reverse();
  let volume=0;const triangles=[];let minArea=Infinity;
  for(const f of faces)for(let k=1;k<f.v.length-1;k++){
    const ids=[f.v[0],f.v[k],f.v[k+1]],[a,b,c]=ids.map(i=>p.positions[i]);const area=Math.hypot(...cross(sub(b,a),sub(c,a)))/2;
    requireThat(Number.isFinite(area)&&area>1e-12,`${p.name}:nonzero triangle`);minArea=Math.min(minArea,area);volume+=dot(a,cross(b,c))/6;triangles.push({v:ids,material:f.material});
  }
  requireThat(Math.abs(volume)>1e-10,`${p.name}:nonzero closed signed volume`);
  if(volume<0){for(const f of faces)f.v.reverse();for(const t of triangles)t.v.reverse();volume=-volume;}
  const chi=p.positions.length-edges.size+faces.length;requireThat(chi===2-2*p.genus,`${p.name}:declared Euler`);
  for(const pos of p.positions)for(const v of pos)requireThat(Number.isFinite(v)&&Math.abs(v)<4,'finite bounded coordinate');
  return {name:p.name,positions:p.positions,triangles,statistics:{vertices:p.positions.length,polygons:faces.length,triangles:triangles.length,edges:edges.size,components:1,boundaryEdges:0,euler:chi,declaredGenus:p.genus,positiveSignedVolume:volume,minTriangleArea:minArea}};
}
const meshes=parts.map(qualify),vertices=meshes.reduce((n,p)=>n+p.positions.length,0),triangles=meshes.reduce((n,p)=>n+p.triangles.length,0);
requireThat(vertices<=d.limits.vertices&&triangles<=d.limits.triangles&&meshes.length<=d.limits.parts,'mesh count cap');
const model={schema:'ari-first-left-shoe-mesh-v1',frame:d.frame,materials:d.materials,parts:meshes,scope:d.scope,connections:'Sole bands share their full Y0.04 interface; upper exterior lower ring matches sole rim atY0.19; lining lower ring matches footbed perimeter atY0.205. Other pieces are separately declared layered/overlapping artist components. No union, collision-free sewing or physical threading mechanism claimed.'};
const modelRaw=JSON.stringify(model)+'\n';let obj='mtllib model.mtl\n# Original unitless LEFT shoe artist blockout; +Yup,+Ztoe,-Xmedial\n',offset=1;
for(const p of meshes){obj+=`o ${p.name}\n`;for(const v of p.positions)obj+=`v ${v.join(' ')}\n`;let current='';for(const f of p.triangles){if(f.material!==current){obj+=`usemtl ${f.material}\n`;current=f.material;}obj+=`f ${f.v.map(i=>i+offset).join(' ')}\n`;}offset+=p.positions.length;}
let mtl='';for(const [name,m] of Object.entries(d.materials)){const c=m.colour.slice(1).match(/../g).map(x=>parseInt(x,16)/255);mtl+=`newmtl ${name}\nKd ${c.join(' ')}\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\n\n`;}
const outputs=[['model.json',modelRaw,d.limits.jsonBytes],['model.obj',obj,d.limits.objBytes],['model.mtl',mtl,d.limits.mtlBytes]];
for(const [name,body,cap] of outputs)requireThat(Buffer.byteLength(body)<=cap,`${name}:output cap`);timed();
for(const [name,body] of outputs)fs.writeFileSync(path.join(root,name),body,{flag:'wx'});
const report={schema:'ari-first-3dshoe-cpu-result-v1',status:'complete',pid:process.pid,node:process.version,started_utc:startedUTC,admission_entry_requested_utc:admission.entry_requested_utc,completed_utc:new Date().toISOString(),admission_sha256:sha(admissionRaw),checkedElapsedMs:performance.now()-started,memorySample:process.memoryUsage(),counts:{parts:meshes.length,vertices,triangles},parts:meshes.map(p=>({name:p.name,...p.statistics})),outputs:outputs.map(([name,body])=>({path:path.join(root,name),bytes:Buffer.byteLength(body),sha256:sha(body)})),limits:'Elapsed begins after static imports;10s checked soft source limit,128MiB Node oldspace cap is not totalRSS/OSwall cap. Memory is one sample, not peak. Closed-component topology/areas/counts do not establish no intersections, physical layering, last/fit or appearance.'};
fs.writeFileSync(path.join(root,'CPU-RESULT.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify(report)+'\n');
