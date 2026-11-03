// One read-only attribution of the frozen Ember eye input and shader mapping.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { BufferGeometry, BufferAttribute, Euler, Vector3, Quaternion } from 'three';
import { readGlb, readAccessor } from '../lut-bake/glb.mjs';
import { decodePng } from '../critic/png.mjs';
import { measureEyeGeometry, CORNEA_IOR, IRIS_RADIUS_UV, PUPIL_RADIUS_UV } from '../../packages/core/src/material/EyeMaterial.js';

const out='docs/evidence/ember-2026-10-31-ocular-attribution/';
const source='docs/evidence/ember-2026-10-31-eye-bridge/candidate.glb';
const expected='bcb87a95d76ad252d2681c614c8d9f34d2f51a87a10077298323066fc9ebcdef';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const begin=process.cpuUsage(),start=performance.now();
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'STARTED.json',JSON.stringify({utc:new Date().toISOString(),pid:process.pid,limits:{cpuSeconds:60,rssBytes:536870912,outputBytes:20971520},scriptHash:sha(fs.readFileSync(import.meta.filename))},null,2),{flag:'wx'});
function guard(){const t=process.cpuUsage(begin);if((t.user+t.system)>60e6||process.memoryUsage().rss>536870912)throw Error('Attribution budget exceeded');}
const sourceHash=sha(fs.readFileSync(source));if(sourceHash!==expected)throw Error('Frozen GLB changed');
const g=readGlb(source),j=g.json;
function mesh(pattern){const m=j.meshes.find(x=>pattern.test(x.name));if(!m||m.primitives.length!==1)throw Error('Ambiguous eye');const p=m.primitives[0],geometry=new BufferGeometry();for(const [a,n,s]of [['POSITION','position',3],['TEXCOORD_0','uv',2]])if(p.attributes[a]!==undefined)geometry.setAttribute(n,new BufferAttribute(readAccessor(g,p.attributes[a]).data,s));return {name:m.name,geometry,p,m};}
const globe=mesh(/high-poly|eyeball/i),cornea=mesh(/cornea/i),measurements=measureEyeGeometry(globe,cornea);
const material=j.materials[globe.p.material],ti=material.pbrMetallicRoughness.baseColorTexture,texture=j.textures[ti.index],im=j.images[texture.source],bv=j.bufferViews[im.bufferView];
if(im.mimeType!=='image/png'||ti.extensions?.KHR_texture_transform)throw Error('Unadmitted image encoding/transform');
const png=g.bin.subarray(bv.byteOffset??0,(bv.byteOffset??0)+bv.byteLength);
if(png.readUInt32BE(16)>2048||png.readUInt32BE(20)>2048)throw Error('Texture dimensions over preflight bound');
const decoded=decodePng(png);guard();fs.writeFileSync(out+'frozen-eye.png',png,{flag:'wx'});
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s),norm=a=>mul(a,1/Math.hypot(...a));
const local=(a,e)=>[dot(a,e.tangent),dot(a,e.bitangent),dot(a,e.axis)];
const fit=JSON.parse(fs.readFileSync('docs/evidence/ember-2026-10-31-measured-fit/candidate-correction-v001.json'));
const linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
function sample(uv){const x=uv[0]*decoded.width-.5,y=uv[1]*decoded.height-.5;const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,rgb=[0,0,0],rgbLinear=[0,0,0];for(const [dx,dy,w]of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const i=(Math.max(0,Math.min(decoded.height-1,yi+dy))*decoded.width+Math.max(0,Math.min(decoded.width-1,xi+dx)))*4;for(let c=0;c<3;c++){rgb[c]+=decoded.pixels[i+c]*w;rgbLinear[c]+=linear(decoded.pixels[i+c])*w;}}return {rgb,encodedLuma:dot(rgb,[.2126,.7152,.0722]),linearLuma:dot(rgbLinear,[.2126,.7152,.0722]),black:Math.max(...rgb)<1/255};}
function uvAt(xy,e){return [e.uvCentre[0]+e.uvJacobian[0]*xy[0]+e.uvJacobian[1]*xy[1],e.uvCentre[1]+e.uvJacobian[2]*xy[0]+e.uvJacobian[3]*xy[1]];}
function refractedUv(p,v,e){const o=sub(p,[0,0,e.corneaCentreZ]),b=dot(o,v),d=Math.max(0,b*b-(dot(o,o)-e.corneaRadius**2)),exit=add(p,mul(v,-b+Math.sqrt(d))),n=norm(sub(exit,[0,0,e.corneaCentreZ])),inc=mul(v,-1),eta=1/CORNEA_IOR,ni=dot(n,inc),k=1-eta*eta*(1-ni*ni);if(k<0)throw Error('Total internal reflection outside contract');const r=sub(mul(inc,eta),mul(n,eta*ni+Math.sqrt(k))),hit=add(exit,mul(r,(e.irisPlaneZ-exit[2])/Math.min(r[2],-1e-4))),len=Math.hypot(hit[0],hit[1]),scale=Math.min(len,e.irisRadius)/Math.max(len,1e-9);return uvAt([hit[0]*scale,hit[1]*scale],e);}
function stats(a){const median=key=>{const v=a.map(x=>x[key]).sort((x,y)=>x-y);return v[Math.floor(v.length/2)]??null;};return {count:a.length,black:a.filter(x=>x.black).length,medianEncodedLuma:median('encodedLuma'),medianLinearLuma:median('linearLuma')};}
const eyes={};
for(const side of ['left','right']){const e=measurements[side],sign=side==='left'?1:-1,p=globe.geometry.attributes.position.array,uv=globe.geometry.attributes.uv.array;
 const directAnnuli=[0,.2,.35,.5,.7,.85,1,1.2].map(radius=>{const a=Array.from({length:72},(_,i)=>{const t=i*Math.PI/36;return sample(uvAt([Math.cos(t)*radius*e.irisRadius,Math.sin(t)*radius*e.irisRadius],e));});return {radius,...stats(a)};});
 const views={};for(const view of ['front','angle']){const c=fit.views[view].camera,q=new Quaternion().setFromEuler(new Euler(c[1],c[0],c[2],'ZYX')).invert(),camera=new Vector3(-c[4],-c[5],Math.exp(c[3])).applyQuaternion(q).add(new Vector3().fromArray(fit.center)).toArray(),a=[],examples=[];
  for(let i=0;i<p.length/3;i++){const xyz=Array.from(p.subarray(i*3,i*3+3));if(xyz[0]*sign<=0)continue;const lp=local(sub(xyz,e.centre),e),radius=Math.hypot(lp[0],lp[1])/e.irisRadius;if(lp[2]<=0||radius<.35||radius>.85)continue;const vu=local(norm(sub(camera,xyz)),e),ruv=refractedUv(lp,vu,e),s=sample(ruv),own=sample([uv[i*2],uv[i*2+1]]);a.push({...s,own});if(examples.length<6)examples.push({vertex:i,radius,meshUv:[uv[i*2],uv[i*2+1]],refractedUv:ruv,rgb:s.rgb,meshRgb:own.rgb});}
  views[view]={refracted:stats(a),meshUv:stats(a.map(x=>x.own)),examples};
 }
 eyes[side]={measurement:e,unrefractedAnnuli:directAnnuli,views};guard();
}
const cpu=process.cpuUsage(begin),result={source,sourceHash,texture:{name:im.name,mime:im.mimeType,sha256:sha(png),width:decoded.width,height:decoded.height,material,textureInfo:ti,sampler:j.samplers?.[texture.sampler]},constants:{IRIS_RADIUS_UV,PUPIL_RADIUS_UV,CORNEA_IOR,pupilScale:1},eyes,limits:'Read-only source attribution, no rendered-pixel or occlusion claim. Bilinear samples at source vertices, no mipmap/lighting simulation; fit camera transformed into source coordinates; rest eyes. A .35–.85 physical annulus intentionally excludes pupil and outer limbus.',resources:{cpuSeconds:(cpu.user+cpu.system)/1e6,wallSeconds:(performance.now()-start)/1000,rssBytes:process.memoryUsage().rss,peakRssBytes:process.resourceUsage().maxRSS*1024}};
const output=JSON.stringify(result,null,2)+'\n';if(Buffer.byteLength(output)+png.length>20971520)throw Error('Output budget');guard();fs.writeFileSync(out+'source-report.json',output,{flag:'wx'});console.log(JSON.stringify({resources:result.resources,texture:result.texture,eyes:Object.fromEntries(Object.entries(eyes).map(([k,v])=>[k,{annuli:v.unrefractedAnnuli,views:Object.fromEntries(Object.entries(v.views).map(([n,x])=>[n,{refracted:x.refracted,meshUv:x.meshUv}]))}]))}));
