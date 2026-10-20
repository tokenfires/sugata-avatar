// Original source-owned short-curl groom. This file is inert until independent/root admission.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Mesh,add,sub,mul,dot,cross,norm,checkMesh} from './groom-tools.mjs';
import {renderPacket} from './groom-render.mjs';

const BASE=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(BASE,'output');
const R=[.135,.180,.150],OUTER=1.025,INNER=1.012,TAU=2*Math.PI;
const EXPECTED={parts:137,vertices:42874,triangles:85200,curls:135,pointsPerCurve:37};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(name,value,pretty=false)=>fs.writeFileSync(path.join(OUT,name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,pretty?2:0)+'\n',{flag:'wx'});
function point(theta,phi,scale=1){return [R[0]*Math.sin(theta)*Math.sin(phi)*scale,R[1]*Math.cos(theta)*scale,R[2]*Math.sin(theta)*Math.cos(phi)*scale];}
function normalAt(p){return norm(p.map((v,k)=>v/(R[k]*R[k])));}
function boundary(phi){const c=Math.cos(phi);return 1.35+(c>=0?-.22*c:.35*(-c));}
function surface(mesh,part,scale,name,ringCount,azimuth,full=false,reverse=false){
 const tri=(a,b,c)=>reverse?mesh.triangle(part,a,c,b):mesh.triangle(part,a,b,c);
 const pole=mesh.vertex(part,name+'.top',[0,R[1]*scale,0]),rings=[];
 for(let i=1;i<=ringCount;i++){
  const ring=[];for(let j=0;j<azimuth;j++){const phi=TAU*j/azimuth,theta=full?Math.PI*i/(ringCount+1):boundary(phi)*i/ringCount;ring.push(mesh.vertex(part,name+'.r'+i+'.a'+j,point(theta,phi,scale)));}rings.push(ring);
 }
 for(let j=0;j<azimuth;j++)tri(pole,rings[0][j],rings[0][(j+1)%azimuth]);
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<azimuth;j++){
  const a=rings[i][j],b=rings[i+1][j],c=rings[i+1][(j+1)%azimuth],d=rings[i][(j+1)%azimuth];tri(a,b,c);tri(a,c,d);
 }
 if(full){const bottom=mesh.vertex(part,name+'.bottom',[0,-R[1]*scale,0]),last=rings.at(-1);for(let j=0;j<azimuth;j++)tri(bottom,last[(j+1)%azimuth],last[j]);}
 return rings.at(-1);
}
function scaffold(mesh){const part=mesh.part('display.scaffold','fictional_display_scaffold','afa9a1');surface(mesh,part,1,'head',23,48,true);part.interfaces={meaning:'fictional featureless unitless display head; no actual Ari anatomy/attachment',radii:R};}
function underlay(mesh){
 const part=mesh.part('groom.underlay','dark_geometric_root_underlay','191513'),outer=surface(mesh,part,OUTER,'outer',12,64),inner=surface(mesh,part,INNER,'inner',12,64,false,true);
 for(let j=0;j<64;j++)mesh.quad(part,outer[j],inner[j],inner[(j+1)%64],outer[(j+1)%64]);
 part.interfaces={outerScale:OUTER,innerScale:INNER,boundary:'1.35-.22cos(phi) on front,1.35+.35abs(cos(phi)) on rear',meaning:'owned all-around root-context shell, not old front-proxy or actual Ari scalp'};
}
function tube(mesh,curve){
 const id='groom.curl.'+String(curve.id).padStart(3,'0'),tone=Math.round(2*Math.sin(curve.id*1.3)),colour=[33+tone,27+tone,23+tone].map(v=>v.toString(16).padStart(2,'0')).join('');
 const part=mesh.part(id,'artist_curl_clump',colour),rings=[];let previous=null;
 for(let i=0;i<curve.points.length;i++){
  const tangent=norm(sub(curve.points[Math.min(curve.points.length-1,i+1)],curve.points[Math.max(0,i-1)]));
  let u=previous?sub(previous,mul(tangent,dot(previous,tangent))):[0,0,0];
  if(Math.hypot(...u)<1e-9)u=cross(Math.abs(tangent[1])<.95?[0,1,0]:[1,0,0],tangent);
  u=norm(u);const v=cross(tangent,u);previous=u;
  const ring=[];for(let j=0;j<8;j++){const a=TAU*j/8;ring.push(mesh.vertex(part,'p'+i+'.s'+j,add(curve.points[i],mul(add(mul(u,Math.cos(a)),mul(v,Math.sin(a))),curve.radii[i]))));}rings.push(ring);
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++)mesh.quad(part,rings[i][j],rings[i][(j+1)%8],rings[i+1][(j+1)%8],rings[i+1][j]);
 const first=mesh.vertex(part,'root.cap',curve.points[0]),last=mesh.vertex(part,'tip.cap',curve.points.at(-1));
 for(let j=0;j<8;j++){mesh.triangle(part,first,rings[0][(j+1)%8],rings[0][j]);mesh.triangle(part,last,rings.at(-1)[j],rings.at(-1)[(j+1)%8]);}
 part.interfaces={curveId:curve.id,root:curve.root,rootParameters:curve.rootParameters,closedClumpNotPhysicalFibre:true,intentionalOverlap:'root underlay and neighboring artist clumps may overlap; no physical packing/contact claim'};
 return part;
}
function curlCurves(mesh){
 const counts=[1,12,20,28,34,40],fractions=[0,.23,.41,.59,.77,.94],curves=[];
 for(let row=0;row<counts.length;row++)for(let j=0;j<counts[row];j++){
  const id=curves.length,phi=TAU*j/counts[row]+row*2.399963229728653+.025*Math.sin((id+1)*2.3),theta=fractions[row]*boundary(phi)*(1+.025*Math.sin((id+1)*1.7));
  const root=point(theta,phi,OUTER),n=normalAt(root);let t=cross([0,1,0],n);if(Math.hypot(...t)<1e-9)t=[1,0,0];t=norm(t);const b=cross(n,t);
  const controls={radius:.0095*(.88+.12*Math.cos(id*1.9)),turns:1.30+.25*Math.sin(id*1.1),curlOnset:.22,phase:phi+.7*Math.sin(id*2.1),guideHeight:.022*(.86+.14*Math.sin(id*.91)),guideLean:.003*Math.sin(phi+row),downwardLean:.007*Math.sin(theta),maxTubeRadius:.0026*(.94+.06*Math.cos(id*1.7))};
  const points=[],guidePoints=[],radii=[];
  for(let i=0;i<=36;i++){
   const s=i/36,guide=add(add(root,mul(n,controls.guideHeight*s)),add(mul(t,controls.guideLean*s*s),[0,-controls.downwardLean*s*s,0]));
   const radius=controls.radius*Math.min(1,s/controls.curlOnset)*(.9+.1*Math.sin(Math.PI*s)),a=controls.phase+TAU*controls.turns*s;
   guidePoints.push(guide);points.push(add(guide,add(mul(t,radius*Math.cos(a)),mul(b,radius*Math.sin(a)))));radii.push(controls.maxTubeRadius*(1-.76*Math.pow(s,2)));
  }
  const curve={id,rootParameters:{theta,phi,outerScale:OUTER},root,controls,guidePoints,points,radii};tube(mesh,curve);curves.push(curve);
 }
 return curves;
}
function sourceChecks(mesh,curves){
 const topology=checkMesh(mesh),failures=[];let rootError=0,minRho=Infinity;const forbidden=[];
 if(mesh.parts.length!==EXPECTED.parts||mesh.positions.length!==EXPECTED.vertices||mesh.triangles.length!==EXPECTED.triangles||curves.length!==EXPECTED.curls)failures.push('declared source counts');
 for(const c of curves){
  const actual=point(c.rootParameters.theta,c.rootParameters.phi,c.rootParameters.outerScale);rootError=Math.max(rootError,Math.hypot(...sub(c.points[0],actual)));
  if(c.points.length!==37||c.guidePoints.length!==37||c.radii.length!==37||!c.points.flat().every(Number.isFinite)||!c.guidePoints.flat().every(Number.isFinite)||!c.radii.every(v=>Number.isFinite(v)&&v>0))failures.push('curve sample/radius '+c.id);
 }
 if(rootError>1e-12)failures.push('declared root equality');
 for(const part of mesh.parts.filter(p=>p.id!=='display.scaffold'))for(const id of part.vertex_ids){const p=mesh.positions[id],rho=Math.sqrt(p.reduce((s,v,k)=>s+(v/R[k])**2,0));minRho=Math.min(minRho,rho);
  const ear=Math.abs(p[0])>.105&&p[1]>=-.05&&p[1]<=.012&&p[2]>=-.045&&p[2]<=.045,face=p[2]>.12&&p[1]<.045;
  if((ear||face)&&forbidden.length<12)forbidden.push({part:part.id,vertex:id,point:p,ear,face});
 }
 if(minRho<1-1e-10)failures.push('hair vertex inside fictional ellipsoid');if(forbidden.length)failures.push('fictional display opening');
 return {pass:topology.pass&&failures.length===0,failures,topology,counts:{parts:mesh.parts.length,vertices:mesh.positions.length,triangles:mesh.triangles.length,curls:curves.length},expected:EXPECTED,rootError,minHairVertexEllipsoidRho:minRho,forbiddenDisplayZoneWitnesses:forbidden,limits:'Finite component topology and sampled source/root/vertex observations only. No all-face head clearance, self/inter-clump collision, physical fibres/packing, actual Ari roots, anatomical ear/face fit, skinning or motion. Root and clump overlap intentional/unqualified.'};
}
function obj(mesh){
 const lines=['# Original unitless curl artist source. display.scaffold is fictional; hide that group for groom-only editing.','mtllib materials.mtl'];
 for(const p of mesh.positions)lines.push('v '+p.join(' '));
 for(const part of mesh.parts){lines.push('g '+part.id,'usemtl '+part.id);for(const f of part.face_ids)lines.push('f '+mesh.triangles[f].map(i=>i+1).join(' '));}return lines.join('\n')+'\n';
}
function materials(mesh){return mesh.parts.map(p=>'newmtl '+p.id+'\nKd '+p.color.match(/\w\w/g).map(h=>parseInt(h,16)/255).join(' ')+'\n').join('\n');}
let owned=false;
try{
 fs.mkdirSync(OUT);owned=true;
 const mesh=new Mesh();scaffold(mesh);underlay(mesh);const curves=curlCurves(mesh),checks=sourceChecks(mesh,curves);write('CHECKS.json',checks,true);
 if(!checks.pass)throw new Error('REFUSE: finite source checks '+JSON.stringify(checks.failures)+' '+JSON.stringify(checks.topology.failures));
 const metadata={source:'Original isolated3Dcurve/clump artist source inspired by Ari artwork, not Ari head/fit/native asset',frame:{up:'+Y',front:'+Z',displayRight:'+X',units:'fictional unitless'},referenceScaffold:'display.scaffold is visible fictional edit context; hide its group for groom-only inspection',limits:checks.limits};
 write('mesh.json',{...mesh,metadata});write('curves.json',{metadata,curves});write('groom.obj',obj(mesh));write('materials.mtl',materials(mesh));
 const packet=renderPacket(mesh);write('first-packet.png',packet.bytes);
 const names=['CHECKS.json','mesh.json','curves.json','groom.obj','materials.mtl','first-packet.png'];
 const status={utc:new Date().toISOString(),state:'first-output-unqualified',pid:process.pid,sourceLockSHA256:sha(path.join(BASE,'SOURCE-LOCK.json')),buildSHA256:sha(fileURLToPath(import.meta.url)),counts:checks.counts,png:{width:packet.width,height:packet.height,projectionChecks:packet.projectionChecks,views:packet.views},files:names.map(name=>({name,bytes:fs.statSync(path.join(OUT,name)).size,sha256:sha(path.join(OUT,name))})),limits:checks.limits};
 write('STATUS.json',status,true);console.log(JSON.stringify({state:status.state,counts:status.counts,png:[packet.width,packet.height],appearance:'UNQUALIFIED until actual first-image/root-independent review'}));
}catch(error){
 process.exitCode=String(error.message).startsWith('REFUSE:')?20:30;
 if(owned)try{write('STATUS.json',{utc:new Date().toISOString(),state:'refused-unqualified',pid:process.pid,error:String(error.stack||error),exit:process.exitCode},true);}catch(statusError){console.error('status-write-failed',String(statusError));}
 console.error(String(error.stack||error));
}
