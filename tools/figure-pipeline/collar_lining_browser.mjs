// Experimental local lining owner; never imported by shipping runtime.
import {SkinnedMesh, BackSide, FrontSide} from 'three';

export function installCollarLining(outer, band) {
    if (Array.isArray(outer.material) || outer.material.side !== FrontSide || !outer.isSkinnedMesh) throw Error('Expected one front-sided skinned garment');
    const geometry = outer.geometry.clone(), material = outer.material.clone();
    geometry.setIndex(band.indices);
    geometry.clearGroups(); geometry.setDrawRange(0, band.indices.length);
    material.name = outer.material.name + '.collar-interior-prototype'; material.side = BackSide;
    // BackSide supplies the inward-facing normal. The original shell already casts both
    // sides into shadow, so this coincident beauty surface must not add a shadow caster.
    const lining = new SkinnedMesh(geometry, material);
    lining.name = 'diagnostic_collar_interior'; lining.frustumCulled = false;
    lining.castShadow = false; lining.receiveShadow = outer.receiveShadow;
    lining.bind(outer.skeleton, outer.bindMatrix); outer.add(lining);
    let disposed = false;
    return {
        mesh: lining,
        report: () => ({triangles: band.triangles.length, vertices: geometry.attributes.position.count,
            materialSide: material.side, castsShadow: lining.castShadow, borrowedSkeleton: lining.skeleton === outer.skeleton,
            originalMaterialSide: outer.material.side, originalVertexIds: true, widthMetres: band.width}),
        dispose() { if (disposed) return; disposed = true; lining.removeFromParent(); geometry.dispose(); material.dispose(); }
    };
}
