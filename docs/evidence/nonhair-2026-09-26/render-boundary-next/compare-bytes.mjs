// Exact logical texel comparison. No threshold; NaN payloads and signed zero remain differences.
export function compareTexels(a,b,{width,height,bytesPerTexel}) {
 if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array))throw Error('Byte arrays required');
 if(![width,height,bytesPerTexel].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('Invalid layout');
 const expected=width*height*bytesPerTexel;
 if(!Number.isSafeInteger(expected)||a.length!==expected||b.length!==expected)throw Error('Unexpected logical byte length');
 let changedBytes=0,changedTexels=0,minX=width,minY=height,maxX=-1,maxY=-1;
 for(let p=0;p<width*height;p++) {
  let changed=false;
  for(let c=0;c<bytesPerTexel;c++)if(a[p*bytesPerTexel+c]!==b[p*bytesPerTexel+c]){changed=true;changedBytes++;}
  if(changed){changedTexels++;const x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 return {exact:changedBytes===0,changedBytes,changedTexels,totalTexels:width*height,bounds:changedTexels?{minX,minY,maxX,maxY}:null,coordinates:'native copied texture origin; no flip or canvas-coordinate inference'};
}
