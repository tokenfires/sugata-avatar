import {vec4} from 'three/tsl';
import {Raycaster,Vector2,Vector3,DoubleSide} from 'three';

export function tag(a){const m=a.wardrobe.wornMeshes.get('foundation_bra').material;m.colorNode=vec4(1,0,1,1);m.needsUpdate=true;}
export function observe(a,windows){
  const w=a.wardrobe,entries=[['body',a.figure.body],...w.wornMeshes],ids=new Map(entries.map(([id,m])=>[m,id])),maps=new Map(),v=new Vector3();
  const materials=[],masks=[],omittedChildren=[];
  for(const[id,m]of entries){
    m.updateMatrixWorld(true);m.skeleton?.update();m.computeBoundingSphere();
    const full=id==='body'?w.fullIndex:w.fragments.get(id).fullIndex;
    maps.set(m,new Map(Array.from({length:full.length/3},(_,i)=>[Array.from(full.slice(i*3,i*3+3)).join(','),i])));
    const x=m.material;materials.push({id,visible:m.visible,side:x.side,depthTest:x.depthTest,depthWrite:x.depthWrite,opacity:x.opacity,transparent:x.transparent,alphaTest:x.alphaTest});
    m.traverse(o=>{if(o!==m&&o.isMesh)omittedChildren.push({parent:id,name:o.name,visible:o.visible,triangles:o.geometry.index?.count/3});});
    if(id!=='body'){const f=w.fragments.get(id);masks.push({id,occludedBy:[...f.occludedBy],attributes:[...f.underMasks].map(([name,attr])=>({name,values:Array.from({length:attr.count},(_,i)=>attr.getX(i))}))});}
  }
  const points=[];for(const[label,x0,y0,x1,y1]of windows)for(let y=y0;y<=y1;y+=8)for(let x=x0;x<=x1;x+=8)points.push({label,x:x+.5,y:y+.5});
  const width=a.stage.canvas.width,height=a.stage.canvas.height,ray=new Raycaster();
  const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const cast=()=>points.map(pixel=>{ray.setFromCamera(new Vector2(pixel.x/width*2-1,1-pixel.y/height*2),a.stage.camera);return{pixel,origin:ray.ray.origin.toArray(),direction:ray.ray.direction.toArray(),hits:ray.intersectObjects(entries.map(e=>e[1]).filter(visible),false).slice(0,8).map(h=>{const m=h.object,indices=[h.face.a,h.face.b,h.face.c],posed=indices.map(i=>m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).clone()),normal=posed[1].clone().sub(posed[0]).cross(posed[2].clone().sub(posed[0])).normalize();return{id:ids.get(m),triangle:maps.get(m).get(indices.join(',')),indices,posed:posed.map(p=>p.toArray()),distance:h.distance,point:h.point.toArray(),facingDot:normal.dot(ray.ray.direction)};})};});
  const ordinary=cast(),cloth=w.wornMeshes.get('female_elegantsuit01'),side=cloth.material.side;let doubleSided;
  try{cloth.material.side=DoubleSide;doubleSided=cast();}finally{cloth.material.side=side;}
  return{width,height,windows,materials,masks,omittedChildren,ordinary,doubleSided,scope:'CPU-skinned primary body/garment drawn surfaces only. Child interiors, hair, temporal raster filtering and shadows excluded. Cloth DoubleSide is CPU-only and restored before rendering.'};
}
