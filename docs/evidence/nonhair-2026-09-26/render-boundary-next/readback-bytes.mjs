// Exact logical texel extraction for the installed WebGPU readback contract.
// Retain raw separately. No float conversion, normalization, threshold or image edit.
const FORMATS=Object.freeze({
 'r8unorm':{bytesPerTexel:1,array:'Uint8Array'},
 'rg8unorm':{bytesPerTexel:2,array:'Uint8Array'},
 'rgba8unorm':{bytesPerTexel:4,array:'Uint8Array'},
 'bgra8unorm':{bytesPerTexel:4,array:'Uint8Array'},
 'rgba8unorm-srgb':{bytesPerTexel:4,array:'Uint8Array'},
 'bgra8unorm-srgb':{bytesPerTexel:4,array:'Uint8Array'},
 'r16float':{bytesPerTexel:2,array:'Uint16Array'},
 'rg16float':{bytesPerTexel:4,array:'Uint16Array'},
 'rgba16float':{bytesPerTexel:8,array:'Uint16Array'}
});
const requireValue=(yes,message)=>{if(!yes)throw Error(message);};
export function packReadback(raw,{format,width,height}) {
 const known=Object.hasOwn(FORMATS,format)?FORMATS[format]:null;
 requireValue(known,'Unsupported uncompressed colour format: '+format);
 requireValue(Number.isSafeInteger(width)&&width>0&&Number.isSafeInteger(height)&&height>0,'Invalid dimensions');
 requireValue(ArrayBuffer.isView(raw)&&!(raw instanceof DataView)&&raw.constructor.name===known.array,'Unexpected native typed array');
 const rowBytes=width*known.bytesPerTexel,rowStride=Math.ceil(rowBytes/256)*256;
 const length=(height-1)*rowStride+rowBytes;
 requireValue(Number.isSafeInteger(length)&&Number.isSafeInteger(rowBytes*height),'Unsafe byte length');
 requireValue(raw.byteLength===length,'Unexpected native readback length');
 const bytes=new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength),pixels=new Uint8Array(rowBytes*height);
 for(let y=0;y<height;y++)pixels.set(bytes.subarray(y*rowStride,y*rowStride+rowBytes),y*rowBytes);
 return {pixels,layout:{format,width,height,bytesPerTexel:known.bytesPerTexel,rowBytes,rowStride,rawBytes:length,pixelBytes:pixels.byteLength,paddingBytes:length-pixels.byteLength,arrayType:known.array}};
}
