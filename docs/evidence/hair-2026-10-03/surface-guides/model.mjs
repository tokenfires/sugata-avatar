export function buildModel(data,source,avatar,T){
 const group=new T.Group(),geometries=[],records=[];let material=null;
 const disposal={disposed:false,attempts:[],errors:[]};
 const dispose=()=>{if(disposal.disposed)return disposal;disposal.disposed=true;const release=(label,fn)=>{disposal.attempts.push(label);try{fn();}catch(e){disposal.errors.push({label,message:String(e.stack??e)});}};release('detach',()=>group.removeFromParent());geometries.forEach((g,i)=>release('geometry-'+i,()=>g.dispose()));if(material)release('material',()=>material.dispose());return disposal;};
 const fail=s=>{throw Error(s);},finite=v=>v.toArray().every(Number.isFinite),vector=a=>new T.Vector3(...a);
 const frame=vertices=>{const u=vertices[1].clone().sub(vertices[0]),normal=u.clone().cross(vertices[2].clone().sub(vertices[0]));if(u.length()<1e-10||normal.length()<1e-12)fail('Degenerate root triangle');u.normalize();normal.normalize();return new T.Matrix3().set(u.x,normal.clone().cross(u).x,normal.x,u.y,normal.clone().cross(u).y,normal.y,u.z,normal.clone().cross(u).z,normal.z);};
 const interpolate=(profile,t)=>{if(t<=profile[0][0])return profile[0][1];for(let i=1;i<profile.length;i++){if(t<=profile[i][0]){const [a,x]=profile[i-1],[b,y]=profile[i];return x+(y-x)*(t-a)/(b-a);}}return profile.at(-1)[1];};
 try{
  const body=avatar.figure.body,head=avatar.figure.bone('head'),fullIndex=avatar.wardrobe?.fullIndex;
  if(!body?.isSkinnedMesh||!head||!fullIndex||body.geometry.attributes.position.count!==data.source.positions)fail('Current body/head/full index unavailable');
  avatar.figure.root.updateMatrixWorld(true);body.skeleton.update();const headWorld=head.matrixWorld.clone();if(!headWorld.elements.every(Number.isFinite)||Math.abs(headWorld.determinant())<1e-10)fail('Invalid head transform');const inverseHead=headWorld.clone().invert();
  material=new T.MeshStandardMaterial({color:data.material.colour,roughness:data.material.roughness,metalness:data.material.metalness,side:T.DoubleSide});
  for(const g of data.guides){
   const src=source.records.find(r=>r.id===g.id);if(!src||JSON.stringify(src.indices)!==JSON.stringify(g.root.indices))fail('Literal source association '+g.id);
   const rest=src.restVertices.map(vector),posed=[];
   for(let i=0;i<3;i++){const id=src.indices[i];if(fullIndex[src.triangle*3+i]!==id)fail('Current source triangle ID mismatch '+g.id);const raw=new T.Vector3().fromBufferAttribute(body.geometry.attributes.position,id);if(raw.distanceTo(rest[i])>1e-8)fail('Current rest POSITION mismatch '+g.id);posed.push(body.getVertexPosition(id,new T.Vector3()).applyMatrix4(body.matrixWorld));}
   const restFrame=frame(rest),posedFrame=frame(posed),rotation=posedFrame.clone().multiply(restFrame.clone().transpose()),posedRoot=new T.Vector3();posed.forEach((v,i)=>posedRoot.addScaledVector(v,g.root.bary[i]));
   const curve=new T.CatmullRomCurve3(g.curve.controls.map(vector),false,'centripetal'),vertices=[],centres=[],tangents=[],indices=[];let widthAxis=null,previous=null;
   for(let i=0;i<g.curve.samples;i++){
    const t=i/(g.curve.samples-1),q=curve.getPoint(t),tangent=curve.getTangent(t).normalize();if(!finite(q)||!finite(tangent)||tangent.length()<.999)fail('Invalid curve '+g.id);
    if(i===0){widthAxis=vector(g.root.normal).cross(tangent);if(widthAxis.length()<1e-8)fail('No initial frame '+g.id);widthAxis.normalize();if(tangent.dot(vector(g.curve.tangents.first))<.999)fail('First tangent mismatch '+g.id);}
    else{if(previous.dot(tangent)<-.99)fail('Ambiguous transport '+g.id);widthAxis.applyQuaternion(new T.Quaternion().setFromUnitVectors(previous,tangent));widthAxis.addScaledVector(tangent,-widthAxis.dot(tangent));if(widthAxis.length()<1e-8)fail('Collapsed transport '+g.id);widthAxis.normalize();}
    if(i===g.curve.samples-1&&tangent.dot(vector(g.curve.tangents.last))<.999)fail('Last tangent mismatch '+g.id);
    const axis=widthAxis.clone().applyAxisAngle(tangent,interpolate(g.section.rollProfile,t)),width=interpolate(g.section.widthProfile,t);if(!Number.isFinite(width)||width<=0)fail('Invalid width '+g.id);
    centres.push(q.toArray());tangents.push(tangent.toArray());
    for(const side of [-1,1]){const sourcePoint=q.clone().addScaledVector(axis,side*width/2),world=sourcePoint.clone().sub(vector(g.root.position)).applyMatrix3(rotation).add(posedRoot);vertices.push(...world.applyMatrix4(inverseHead).toArray());}
    if(i>0){const b=i*2;indices.push(b-2,b-1,b,b-1,b+1,b);}previous=tangent;
   }
   const geometry=new T.BufferGeometry();geometries.push(geometry);geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
   const actualPosition=geometry.attributes.position,actualNormal=geometry.attributes.normal,actualIndex=geometry.index,validation={minDoubleArea:Infinity,maxNormalUnitError:0};
   for(let i=0;i<actualNormal.count;i++){const n=new T.Vector3().fromBufferAttribute(actualNormal,i),length=n.length(),error=Math.abs(length-1);if(!finite(n)||!Number.isFinite(length)||error>2e-6)fail('Actual NORMAL rejected '+JSON.stringify({guide:g.id,vertex:i,normal:n.toArray(),length}));validation.maxNormalUnitError=Math.max(validation.maxNormalUnitError,error);}
   for(let i=0;i<actualIndex.count;i+=3){const ids=[actualIndex.getX(i),actualIndex.getX(i+1),actualIndex.getX(i+2)],abc=ids.map(id=>new T.Vector3().fromBufferAttribute(actualPosition,id)),area=abc[1].clone().sub(abc[0]).cross(abc[2].clone().sub(abc[0])).length();if(!abc.every(finite)||!Number.isFinite(area)||area<1e-12)fail('Actual POSITION triangle rejected '+JSON.stringify({guide:g.id,triangle:i/3,ids,positions:abc.map(v=>v.toArray()),doubleArea:area}));validation.minDoubleArea=Math.min(validation.minDoubleArea,area);}
   const mesh=new T.Mesh(geometry,material);mesh.name=g.id;mesh.frustumCulled=false;group.add(mesh);
   records.push({id:g.id,sourceTriangle:src,posedVertices:posed.map(v=>v.toArray()),posedRoot:posedRoot.toArray(),restFrame:restFrame.toArray(),posedFrame:posedFrame.toArray(),rotation:rotation.toArray(),centres,tangents,headLocalVertices:Array.from(geometry.attributes.position.array),normals:Array.from(geometry.attributes.normal.array),indices:Array.from(geometry.index.array),validation,vertices:vertices.length/3,triangles:indices.length/3});
  }
  group.name='Isolated surface-rooted modelling bands';head.add(group);group.visible=false;group.updateMatrixWorld(true);
  return {group,records,attachment:{body:body.name,bodyWorld:body.matrixWorld.toArray(),head:head.name,headWorld:headWorld.toArray(),inverseHead:inverseHead.toArray(),scope:'Actual morph/skinned per-root triangle frame at one static pose; rigid head-local geometry, no whole-curve skinning/fit'},dispose};
 }catch(e){const released=dispose();if(released.errors.length)throw new Error(String(e.stack??e)+'\nModel cleanup errors: '+JSON.stringify(released.errors),{cause:e});throw e;}
}
