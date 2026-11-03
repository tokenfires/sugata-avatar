// Derivatives in mesh units per atlas UV unit. Uneven row spacing is intentional.
// Do not normalize here: HairMaterial uses the magnitude for strand pitch.
export function cardFrames(position, uv, mapping) {
  const count=position.length/3,along=new Float32Array(position.length),across=new Float32Array(position.length);
  const visited=new Uint8Array(count);let minSinAngle=1,minAlong=Infinity,minAcross=Infinity;
  function difference(out,i,lo,hi,axis){
    const gap=uv[hi*2+axis]-uv[lo*2+axis];
    if(!(gap>0))throw Error('Non-increasing card coordinate');
    for(let k=0;k<3;k++)out[i*3+k]=(position[hi*3+k]-position[lo*3+k])/gap;
  }
  for(const m of mapping){
    const rows=m.vertexCount/3;
    if(!Number.isInteger(rows)||rows<2||m.vertexStart+m.vertexCount>count)throw Error('Invalid three-column ribbon');
    for(let r=0;r<rows;r++)for(let c=0;c<3;c++){
      const i=m.vertexStart+r*3+c;if(visited[i]++)throw Error('Overlapping ribbon mapping');
      if(r===0)difference(along,i,i,i+3,1);
      else if(r===rows-1)difference(along,i,i-3,i,1);
      else{
        const h0=uv[i*2+1]-uv[(i-3)*2+1],h1=uv[(i+3)*2+1]-uv[i*2+1];
        if(!(h0>0&&h1>0))throw Error('Non-increasing card rows');
        for(let k=0;k<3;k++)along[i*3+k]=
          ((position[i*3+k]-position[(i-3)*3+k])/h0*h1+
           (position[(i+3)*3+k]-position[i*3+k])/h1*h0)/(h0+h1);
      }
      difference(across,i,m.vertexStart+r*3+Math.max(0,c-1),m.vertexStart+r*3+Math.min(2,c+1),0);
      const a=along.subarray(i*3,i*3+3),b=across.subarray(i*3,i*3+3);
      const la=Math.hypot(...a),lb=Math.hypot(...b),s=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/(la*lb);
      if(![...a,...b,s].every(Number.isFinite)||la<1e-6||lb<1e-6||s<1e-4)throw Error('Collapsed card frame '+m.guide+' row '+r);
      minAlong=Math.min(minAlong,la);minAcross=Math.min(minAcross,lb);minSinAngle=Math.min(minSinAngle,s);
    }
  }
  if(visited.some(n=>n!==1))throw Error('Unmapped card vertex');
  return {along,across,report:{vertices:count,method:'uneven-row central derivatives; per-column cross derivative',
    normalized:false,minAlong,minAcross,minSinAngle,addedBytes:along.byteLength+across.byteLength}};
}
