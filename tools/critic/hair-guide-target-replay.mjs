/** New SVG annotations over pinned native PNGs/pose; no Avatar or WebGPU render. */
const response=await fetch(new URLSearchParams(location.search).get('data'));if(!response.ok)throw Error('Input HTTP '+response.status);
const data=await response.json(),ns='http://www.w3.org/2000/svg',svg=document.querySelector('#sheet'),image=document.querySelector('#native');
if(innerWidth!==900||innerHeight!==868)throw Error('Declared viewport required');
const colors=['#ffce69','#ff7a8a','#ca8aff','#55e4dc','#73a6ff','#9adb8a'];
const apply=(m,p)=>Array.from({length:4},(_,r)=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]);
function project(point,state){let p=[...point,1];for(const m of [state.bindMatrix,state.boneInverses[44],state.bones[44].matrix,state.bindMatrixInverse,state.bodyMatrix])p=apply(m,p);
 if(Math.abs(p[3]-1)>1e-10)throw Error('Non-affine target pose');const world=p.slice(0,3),camera=apply(state.camera.inverse,p),clip=apply(state.camera.projection,camera);
 if(clip[3]<=0)throw Error('Target behind camera');const ndc=clip.slice(0,3).map(v=>v/clip[3]),pixel=[(ndc[0]+1)*450,(1-ndc[1])*434];
 if([...world,...ndc,...pixel].some(v=>!Number.isFinite(v)))throw Error('Nonfinite annotation');return{rest:point,world,ndc,pixel};
}
const element=(name,attrs)=>{const e=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const points=a=>a.map(p=>p.pixel.join(',')).join(' ');
window.drawGuideTarget=async({view,orientation})=>{
 const native=data.views.find(v=>v.view===view),target=data.target.orientations[orientation];if(!native||!target)throw Error('Unknown view/orientation');
 if(native.state.bones[44].name!=='head')throw Error('Head44 mismatch');image.src=native.nativeURL;await image.decode();
 if(image.naturalWidth!==900||image.naturalHeight!==868)throw Error('Native image size');svg.replaceChildren();
 const projected=[];
 for(let g=0;g<6;g++){
  const guide=target.guides[g],records=guide.records.map(r=>({t:r.t,centre:project(r.centre,native.state),minus:project(r.minus,native.state),plus:project(r.plus,native.state)})),controls=guide.points.map(p=>project(p,native.state)),centreline=guide.annotation.map(r=>project(r.centre,native.state)),triangles=[];
  for(let i=0;i<16;i++)triangles.push([records[i].minus,records[i].plus,records[i+1].plus],[records[i].minus,records[i+1].plus,records[i+1].minus]);
  for(const tri of triangles)svg.append(element('polygon',{points:points(tri),fill:colors[g],'fill-opacity':'.23',stroke:'none','data-role':guide.role}));
  for(const edge of ['minus','plus'])svg.append(element('polyline',{points:points(records.map(r=>r[edge])),fill:'none',stroke:colors[g],'stroke-width':'1.5'}));
  svg.append(element('polyline',{points:points(centreline),fill:'none',stroke:colors[g],'stroke-width':'2.2'}));
  const label=element('text',{x:records[0].centre.pixel[0]+5,y:records[0].centre.pixel[1]-5,fill:colors[g],stroke:'#111','stroke-width':2,'paint-order':'stroke','font-size':14});label.textContent=orientation+String(g+1);svg.append(label);
  svg.append(element('circle',{cx:records[0].centre.pixel[0],cy:records[0].centre.pixel[1],r:3,fill:colors[g]}));
  projected.push({role:guide.role,width:guide.width,records,controls,centreline,triangleCount:triangles.length});
 }
 const label=element('text',{x:18,y:837,fill:'#fff',stroke:'#111','stroke-width':3,'paint-order':'stroke','font-size':15});label.textContent=`${orientation} · artist sheets / head44 pose · unoccluded retained-native replay`;svg.append(label);
 return{view,orientation,nativeURL:image.src,nativeInput:native.beauty,state:native.state,dimensions:[image.naturalWidth,image.naturalHeight],projected,triangles:svg.querySelectorAll('polygon').length,
  registration:'bodyWorld*bindInverse*headWorld*headInverseBind*bind*artistPoint; no target morph',unoccluded:true,replay:true,avatarRuns:0,svgOuterHTML:svg.outerHTML};
};
window.captureReady=true;
