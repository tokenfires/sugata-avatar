// Original fixed curl inspection packet; generic depth-raster pattern adapted as declared in DESIGN.
import {add,sub,mul,dot,cross,norm,png} from './groom-tools.mjs';

const FONT={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01111'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 N:['10001','11001','11001','10101','10011','10011','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 W:['10001','10001','10001','10101','10101','10101','01010'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '-':['00000','00000','00000','11111','00000','00000','00000']
};
function text(rgb,W,H,s,x,y,scale=2){
 for(const ch of s){const glyph=FONT[ch];if(glyph)for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(glyph[j][i]==='1')for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const px=x+i*scale+dx,py=y+j*scale+dy;if(px>=0&&px<W&&py>=0&&py<H){const o=(py*W+px)*3;rgb[o]=65;rgb[o+1]=65;rgb[o+2]=61;}
 }x+=6*scale;}
}
export function renderPacket(mesh){
 const W=1440,H=1120,SW=720,SH=560,rgb=Buffer.alloc(W*H*3);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=(y*W+x)*3,v=244-Math.floor((y%SH)/SH*9);rgb[o]=v;rgb[o+1]=v-1;rgb[o+2]=v-4;}
 const views=[
  {name:'FRONT +Z',forward:[0,0,1],upRef:[0,1,0],target:[0,.0125,0],scale:1080,offset:[0,0]},
  {name:'RIGHT SIDE +X',forward:[1,0,0],upRef:[0,1,0],target:[0,.0125,0],scale:1080,offset:[SW,0]},
  {name:'REAR -Z',forward:[0,0,-1],upRef:[0,1,0],target:[0,.0125,0],scale:1080,offset:[0,SH]},
  {name:'TOP +Y FRONT DOWN',forward:[0,1,0],upRef:[0,0,-1],target:[0,0,0],scale:1080,offset:[SW,SH]}
 ];
 const parts=new Map(mesh.parts.map(p=>[p.id,p])),sumNormals=mesh.positions.map(()=>[0,0,0]),faceNormals=[];
 for(let f=0;f<mesh.triangles.length;f++){const ids=mesh.triangles[f],[a,b,c]=ids.map(v=>mesh.positions[v]),n=cross(sub(b,a),sub(c,a));faceNormals.push(norm(n));for(const v of ids)sumNormals[v]=add(sumNormals[v],n);}
 const normals=sumNormals.map(n=>norm(n)),projectionChecks=[];
 for(const view of views){
  const forward=norm(view.forward),right=norm(cross(view.upRef,forward)),up=cross(forward,right);
  const light=norm(add(add(mul(right,-.55),mul(up,.8)),mul(forward,1.1))),half=norm(add(light,forward));
  const depth=new Float64Array(SW*SH);depth.fill(-Infinity);
  const projected=mesh.positions.map(p=>{const q=sub(p,view.target);return [SW/2+dot(q,right)*view.scale,SH/2-dot(q,up)*view.scale,dot(q,forward)];});
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(const p of mesh.parts.filter(p=>p.visible))for(const id of p.vertex_ids){const q=projected[id];bounds.minX=Math.min(bounds.minX,q[0]);bounds.maxX=Math.max(bounds.maxX,q[0]);bounds.minY=Math.min(bounds.minY,q[1]);bounds.maxY=Math.max(bounds.maxY,q[1]);}
  const within=bounds.minX>=16&&bounds.maxX<=SW-16&&bounds.minY>=38&&bounds.maxY<=SH-24;
  projectionChecks.push({name:view.name,bounds,within});if(!within)throw new Error('REFUSE: fixed projection clips '+view.name);
  for(let f=0;f<mesh.triangles.length;f++){
   const part=parts.get(mesh.faceParts[f]);if(!part.visible)continue;
   const ids=mesh.triangles[f],[a,b,c]=ids.map(v=>projected[v]);
   const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
   const minX=Math.max(8,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(SW-9,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(32,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(SH-20,Math.ceil(Math.max(a[1],b[1],c[1])));
   const colour=part.color.match(/\w\w/g).map(h=>parseInt(h,16)),hair=part.role!=='fictional_display_scaffold';
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,w=1-u-v;
    if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],index=y*SW+x;if(z<=depth[index])continue;depth[index]=z;
    let n=add(add(mul(normals[ids[0]],u),mul(normals[ids[1]],v)),mul(normals[ids[2]],w));n=Math.hypot(...n)>1e-12?norm(n):faceNormals[f];if(dot(n,forward)<0)n=mul(n,-1);
    const diffuse=.50+.50*Math.max(0,dot(n,light)),spec=Math.pow(Math.max(0,dot(n,half)),hair?28:16)*(hair?18:5),o=((y+view.offset[1])*W+x+view.offset[0])*3;
    for(let k=0;k<3;k++)rgb[o+k]=Math.max(0,Math.min(255,Math.round(colour[k]*diffuse+spec)));
   }
  }
  text(rgb,W,H,view.name,view.offset[0]+20,view.offset[1]+12);
  text(rgb,W,H,'CURL DRAFT  FICTIONAL HEAD',view.offset[0]+20,view.offset[1]+SH-17,1);
  for(let x=0;x<SW;x++)for(let k=0;k<3;k++)rgb[(view.offset[1]*W+x+view.offset[0])*3+k]=211;
 }
 return {bytes:png(rgb,W,H),width:W,height:H,projectionChecks,views:views.map(v=>({...v,lighting:'fixed camera-relative inspection key, not physical lighting proof'}))};
}
