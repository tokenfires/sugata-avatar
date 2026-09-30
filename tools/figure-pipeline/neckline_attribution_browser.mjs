import {vec4} from 'three/tsl';
import {Raycaster,Vector2,Vector3,DoubleSide,BufferAttribute} from 'three';
/** CPU skinned picking; temporary index/side substitutions are restored synchronously. */
export function necklinePicks(a,windows){
 const w=a.wardrobe,objects=[a.figure.body,...w.wornMeshes.values()],ids=new Map([[a.figure.body,'body'],...Array.from(w.wornMeshes,([id,m])=>[m,id])]);
 const full=new Map(),maps=new Map(),v=new Vector3();
 for(const m of objects){m.updateMatrixWorld(true);m.skeleton?.update();m.computeBoundingSphere();const ix=m===a.figure.body?w.fullIndex:w.fragments.get(ids.get(m)).fullIndex;full.set(m,ix);maps.set(m,new Map(Array.from({length:ix.length/3},(_,i)=>[Array.from(ix.slice(3*i,3*i+3)).join(','),i])));}
 const points=[];for(const [label,x0,y0,x1,y1]of windows)for(let y=y0;y<=y1;y+=4)for(let x=x0;x<=x1;x+=4)points.push({label,x:x+.5,y:y+.5});
 const ray=new Raycaster(),width=a.stage.canvas.width,height=a.stage.canvas.height;
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const cast=()=>points.map(pixel=>{ray.setFromCamera(new Vector2(pixel.x/width*2-1,1-pixel.y/height*2),a.stage.camera);return{pixel,hits:ray.intersectObjects(objects.filter(visible),false).slice(0,6).map(h=>{const m=h.object,tri=[h.face.a,h.face.b,h.face.c],p=tri.map(i=>m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).clone()),n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();return{id:ids.get(m),triangle:maps.get(m).get(tri.join(',')),vertices:tri,distance:h.distance,point:h.point.toArray(),posed:p.map(x=>x.toArray()),facingDot:n.dot(ray.ray.direction)};})};});
 const ordinary=cast(),cloth=w.wornMeshes.get('female_casualsuit01'),side=cloth.material.side;let doubleSided,fullBody;
 try{cloth.material.side=DoubleSide;doubleSided=cast();}finally{cloth.material.side=side;}
 const g=a.figure.body.geometry,index=g.index,range={...g.drawRange};
 try{g.setIndex(new BufferAttribute(full.get(a.figure.body),1));g.setDrawRange(0,full.get(a.figure.body).length);fullBody=cast();}finally{g.setIndex(index);g.setDrawRange(range.start,range.count);}
 return{width,height,windows,scope:'CPU skinned drawn triangles; excludes GPU hair, raster coverage, temporal filtering and shadows. Full body is counterfactual CPU-only.',ordinary,doubleSided,fullBody};
}

/** Imported through Vite so the bare TSL specifier is resolved before page.evaluate. */
export function diffuseTag(material,r,g,b){material.colorNode=vec4(r,g,b,1);material.needsUpdate=true;}
