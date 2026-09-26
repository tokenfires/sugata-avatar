import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Matrix4,Matrix3,Vector3,Quaternion} from 'three';
import {readGlb,readPrimitive} from '../../../../tools/lut-bake/glb.mjs';
import {decodePng} from '../../../../tools/critic/png.mjs';
import {sampleLinear,summarizeSamples} from './albedo-sampling.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(path.join(ROOT,f)));
const sourceFiles=['assets/wardrobe/body/g050.glb','tools/lut-bake/glb.mjs','tools/critic/png.mjs','tools/critic/color.mjs',
    'packages/core/src/material/SkinMaterial.js','node_modules/three/examples/jsm/loaders/GLTFLoader.js',
    'node_modules/three/build/three.core.js',...['sample-albedo.mjs','albedo-sampling.mjs','albedo-sampling.selftest.mjs'].map(n=>path.relative(ROOT,path.join(HERE,n)))];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
assert.equal(sources['assets/wardrobe/body/g050.glb'],'fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a');
const glb=readGlb(path.join(ROOT,'assets/wardrobe/body/g050.glb')),j=glb.json;
const meshIndex=j.meshes.findIndex(m=>m.name==='base.001'),mesh=j.meshes[meshIndex],primitive=mesh.primitives[0];
assert.equal(mesh.primitives.length,1);assert.equal(primitive.mode??4,4);
const p=readPrimitive(glb,'base.001'),material=j.materials[primitive.material],textureInfo=material.pbrMetallicRoughness.baseColorTexture;
assert.equal(textureInfo.texCoord??0,0);assert.equal(textureInfo.extensions,undefined);assert.equal(primitive.extensions,undefined);
assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor??[1,1,1,1],[1,1,1,1]);
const texture=j.textures[textureInfo.index],sampler=j.samplers[texture.sampler];
assert.equal(sampler.wrapS??10497,10497);assert.equal(sampler.wrapT??10497,10497);
const im=j.images[texture.source],view=j.bufferViews[im.bufferView];assert.equal(im.mimeType,'image/png');
const png=glb.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),image=decodePng(png);
assert.equal(sha(png),'b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc');
assert.deepEqual([image.width,image.height],[2048,2048]);
const parents=new Map();j.nodes.forEach((n,i)=>(n.children??[]).forEach(k=>{assert.ok(!parents.has(k));parents.set(k,i);}));
const matrices=new Map();
function matrix(i){if(matrices.has(i))return matrices.get(i);const n=j.nodes[i];
    const local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation??[0,0,0])),new Quaternion(...(n.rotation??[0,0,0,1])),new Vector3(...(n.scale??[1,1,1])));
    const result=parents.has(i)?matrix(parents.get(i)).clone().multiply(local):local;matrices.set(i,result);return result;}
function landmark(name){const matches=j.nodes.map((n,i)=>n.name===name?i:-1).filter(i=>i>=0);assert.equal(matches.length,1);return new Vector3().setFromMatrixPosition(matrix(matches[0]));}
const nodeIndex=j.nodes.findIndex(n=>n.mesh===meshIndex),world=matrix(nodeIndex),normalMatrix=new Matrix3().getNormalMatrix(world);
assert.deepEqual(world.elements,new Matrix4().elements,'This declared geometry frame is the shipped identity mesh transform.');
const points=Array.from({length:p.vertexCount},(_,i)=>new Vector3().fromArray(p.positions,3*i).applyMatrix4(world));
const normals=Array.from({length:p.vertexCount},(_,i)=>new Vector3().fromArray(p.normals,3*i).applyNormalMatrix(normalMatrix));
const landmarks={},regions={},bands={knee:[-.12,.12],midShin:[.35,.65]};
for(const side of ['l','r']){
    const knee=landmark('calf_'+side),ankle=landmark('foot_'+side),axis=ankle.clone().sub(knee),length=axis.length();
    landmarks[side]={knee:knee.toArray(),ankle:ankle.toArray(),lowerLegLengthM:length};
    for(const [band,[lo,hi]]of Object.entries(bands)){
        const samples=[];
        for(let f=0;f<p.triangleCount;f++){
            const ids=Array.from(p.indices.slice(3*f,3*f+3)),[a,b,c]=ids.map(i=>points[i]),centroid=a.clone().add(b).add(c).multiplyScalar(1/3);
            const t=centroid.clone().sub(knee).dot(axis)/axis.lengthSq();if(t<lo||t>hi)continue;
            const axisPoint=knee.clone().addScaledVector(axis,t),radial=centroid.clone().sub(axisPoint);
            if(radial.length()>.45*length||radial.z<=0)continue;
            const normal=ids.reduce((sum,i)=>sum.add(normals[i]),new Vector3()).normalize();if(normal.z<.5)continue;
            const area=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;assert.ok(area>0);
            const uv=[0,1].map(k=>ids.reduce((sum,i)=>sum+p.uvs[2*i+k],0)/3);
            samples.push({triangle:f,vertexIds:ids,centroid:centroid.toArray(),normal:normal.toArray(),axisFraction:t,uv,area,linearRGB:sampleLinear(image,...uv)});
        }
        regions[side+'-'+band]={definition:{boneAxis:['calf_'+side,'foot_'+side],axisFraction:[lo,hi],maxRadiusInLegLengths:.45,front:'radial world z > 0 and mean exported normal z >= 0.5'},...summarizeSamples(samples),samples};
    }
}
const output=path.resolve(HERE,process.argv[2]??'albedo-v1.json');assert.ok(output.startsWith(HERE+path.sep));assert.ok(!fs.existsSync(output));
for(const[f,h]of Object.entries(sources))assert.equal(hash(f),h,'Input changed: '+f);
const report={kind:'g050-bone-relative-front-knee-shin-diffuse-sampling',completed:true,createdAt:new Date().toISOString(),sources,
    image:{sha256:sha(png),bytes:png.length,width:image.width,height:image.height,colorType:image.colorType,bitDepth:image.bitDepth,sampler},landmarks,regions,
    scope:'CPU level-zero linear-light bilinear sampling at geometry triangle centroids, weighted by rest surface area. Seam-split UVs and full triangle IDs retained. Bands approximate front knee and mid-shin surfaces from native rest bone landmarks; they are not painted anatomical masks.',
    limits:['No rendered colour, light, normal, texture mip, postprocess, animation or perception measurement.','Centroid quadrature is an approximation, not an integral over all atlas pixels.','No asset or material edit, native A/B or performance qualification.','Jaw is deliberately omitted: no validated lower-face boundary is defined by this leg protocol.']};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(fs.readFileSync(output)),regions:Object.fromEntries(Object.entries(regions).map(([k,{samples,...v}])=>[k,v]))},null,2));
