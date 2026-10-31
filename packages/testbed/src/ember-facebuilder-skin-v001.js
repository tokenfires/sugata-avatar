import { Color, Float32BufferAttribute, MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, mix, texture, vec3 } from 'three/tsl';

// One isolated coverage experiment. Coordinates belong to the unchanged FaceBuilder
// export; this is an authored trust boundary, not a qualified anatomical region map.
export const SKIN_COVERAGE_V001=Object.freeze({
    front:[0.58,0.84],top:[0.78,0.93],bottom:[-0.84,-0.72],side:[0.62,0.78],
    fallback:'#bf9c87'
});
function smooth(a,b,value){
    const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
    return t*t*(3-2*t);
}
export function createCoverageStudy(mesh){
    const p=mesh.geometry.getAttribute('position');
    const weights=new Float32Array(p.count);
    const c=SKIN_COVERAGE_V001;
    const stats={trusted:0,blend:0,fallback:0,vertices:p.count,attributeBytes:weights.byteLength};
    for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const w=smooth(...c.front,z)*(1-smooth(...c.top,y))*
            smooth(...c.bottom,y)*(1-smooth(...c.side,Math.abs(x)));
        if(!Number.isFinite(w))throw new Error('Non-finite skin trust weight');
        weights[i]=w;
        stats[w===1?'trusted':w===0?'fallback':'blend']++;
    }
    mesh.geometry.setAttribute('skinTrustV001',new Float32BufferAttribute(weights,1));
    const fallback=new Color(c.fallback);
    const material=new MeshBasicNodeMaterial();
    material.colorNode=mix(vec3(fallback.r,fallback.g,fallback.b),
        texture(mesh.material.map).rgb,attribute('skinTrustV001','float'));
    return {material,stats};
}
