// Read-only byte admission for the Rename controller; no native loader hooks.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function embeddedImages(bytes,{asset,assetSHA256}){
 assert.equal(sha256(bytes),assetSHA256,'Parent GLB bytes changed');
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 let offset=12;const chunks=[];
 while(offset<bytes.length){assert.ok(offset+8<=bytes.length,'Truncated GLB chunk');const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);assert.equal(length%4,0);assert.ok(offset+8+length<=bytes.length,'Truncated GLB payload');chunks.push({type,data:bytes.subarray(offset+8,offset+8+length)});offset+=8+length;}
 assert.equal(chunks.length,2,'Expected current inline JSON/BIN GLB');assert.equal(chunks[0].type,0x4e4f534a);assert.equal(chunks[1].type,0x004e4942);
 const j=JSON.parse(chunks[0].data.toString()),bin=chunks[1].data;assert.equal(j.buffers.length,1);assert.equal(j.buffers[0].uri,undefined);assert.ok(Number.isSafeInteger(j.buffers[0].byteLength)&&j.buffers[0].byteLength<=bin.length&&bin.length-j.buffers[0].byteLength<4);
 return(j.images??[]).map((im,image)=>{assert.equal(im.uri,undefined,'External image is not an embedded witness');assert.equal(im.mimeType,'image/png');assert.ok(Number.isSafeInteger(im.bufferView));const v=j.bufferViews[im.bufferView];assert.ok(v&&v.buffer===0);const start=v.byteOffset??0,end=start+v.byteLength;assert.ok(Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(v.byteLength)&&v.byteLength>0&&end<=j.buffers[0].byteLength,'Invalid image view');const imageBytes=bin.subarray(start,end);assert.equal(imageBytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature');return{asset,assetSHA256,image,bufferView:im.bufferView,mimeType:im.mimeType,byteOffset:start,byteLength:v.byteLength,sha256:sha256(imageBytes)};});
}
export function responseKind(url,origin){const u=new URL(url);assert.equal(u.origin,origin,'External response');assert.ok(u.protocol==='http:'||u.protocol==='blob:','Unsupported response protocol');return u.protocol==='blob:'?'embedded-image':'http';}
export function bindEmbeddedResponse({url,origin,status,mimeType,bytes},catalog){assert.equal(responseKind(url,origin),'embedded-image');assert.equal(status,200);assert.equal(mimeType,'image/png');const hash=sha256(bytes);const witnesses=catalog.filter(x=>x.sha256===hash&&x.byteLength===bytes.length&&x.mimeType===mimeType);assert.ok(witnesses.length>0,'Blob bytes have no exact embedded-image witness');return{kind:'embedded-image',sha256:hash,bytes:bytes.length,mimeType,witnesses};}
export function assertEmbeddedParents(responses){for(const r of responses.filter(r=>r.kind==='embedded-image'))assert.ok(r.witnesses.some(w=>responses.some(parent=>parent.kind==='http'&&parent.phase===r.phase&&parent.sha256===w.assetSHA256)),'Embedded image has no successfully observed exact parent HTTP bytes');}
