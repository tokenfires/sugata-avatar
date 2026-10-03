/** New rigid modelling surfaces. No production groom/card/atlas data is consumed or changed. */
export function buildProposal(p,T){
 const group=new T.Group();group.name='preview-owned-whole-front';
 const material=new T.MeshStandardNodeMaterial({color:p.modellingColour,roughness:p.roughness,metalness:p.metalness,side:T.DoubleSide});
 const records=[];
 for(const sign of [-1,1]){
  const positions=[],uvs=[],indices=[];
  const vertex=(x,y,z,u,v)=>{const i=positions.length/3;positions.push(x,y,z);uvs.push(u,v);return i;};
  const tri=(a,b,c)=>indices.push(...(sign===1?[a,b,c]:[a,c,b]));
  const phi=j=>sign*Math.PI*j/p.azimuthSegments;
  const boundary=f=>p.centre[1]+p.frontLift*Math.max(Math.cos(f),0)**4-p.rearDrop*Math.max(-Math.cos(f),0)**2;
  const apex=vertex(sign*p.partHalfGap,p.crownY,p.centre[2],.5,0),rings=[];
  for(let r=1;r<=p.capRings;r++){
   const q=r/p.capRings,row=[];
   for(let j=0;j<=p.azimuthSegments;j++){const f=phi(j);row.push(vertex(sign*p.partHalfGap+p.radiusX*q*Math.sin(f),p.crownY-(p.crownY-boundary(f))*q*q,p.centre[2]+p.radiusZ*q*Math.cos(f),j/p.azimuthSegments,q*.5));}
   if(r===1)for(let j=0;j<p.azimuthSegments;j++)tri(apex,row[j],row[j+1]);
   else{const prior=rings.at(-1);for(let j=0;j<p.azimuthSegments;j++){tri(prior[j],row[j],row[j+1]);tri(prior[j],row[j+1],prior[j+1]);}}
   rings.push(row);
  }
  const first=Math.ceil(p.sideOpeningRadians/Math.PI*p.azimuthSegments);let prior=rings.at(-1).slice(first);
  for(let r=1;r<=p.sideRows;r++){
   const v=r/p.sideRows,scale=1-p.endTaper*v*v,row=[];
   for(let j=first;j<=p.azimuthSegments;j++){const f=phi(j);row.push(vertex(sign*p.partHalfGap+p.radiusX*scale*Math.sin(f),boundary(f)*(1-v)+p.endY*v,p.centre[2]+p.radiusZ*scale*Math.cos(f),j/p.azimuthSegments,.5+v*.5));}
   for(let j=0;j<row.length-1;j++){tri(prior[j],row[j],row[j+1]);tri(prior[j],row[j+1],prior[j+1]);}prior=row;
  }
  if(!positions.every(Number.isFinite))throw Error('Nonfinite proposal');
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
  const mesh=new T.Mesh(geometry,material);mesh.name=sign<0?'left-modelling-mass':'right-modelling-mass';group.add(mesh);
  records.push({name:mesh.name,vertices:positions.length/3,triangles:indices.length/3,sideStartAzimuthDegrees:first*Math.PI/p.azimuthSegments*180/Math.PI,sharedCapSideBoundary:true,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}});
 }
 return {group,material,records,dispose(){group.removeFromParent();for(const mesh of group.children)mesh.geometry.dispose();material.dispose();}};
}
