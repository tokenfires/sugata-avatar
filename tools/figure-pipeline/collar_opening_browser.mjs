// Diagnostic only: CPU picking at an unjittered camera, followed by real GPU controls.
import { Raycaster, Vector2, Vector3, DoubleSide } from 'three';

export function pick(avatar, points) {
    const wardrobe = avatar.wardrobe;
    const objects = [avatar.figure.body, ...wardrobe.wornMeshes.values()];
    const ids = new Map([[avatar.figure.body, 'body'], ...Array.from(wardrobe.wornMeshes, ([id, m]) => [m, id])]);
    const maps = new Map();
    for (const mesh of objects) {
        mesh.updateMatrixWorld(true);
        mesh.computeBoundingSphere();
        const full = mesh === avatar.figure.body ? wardrobe.fullIndex : wardrobe.fragments.get(ids.get(mesh)).fullIndex;
        maps.set(mesh, new Map(Array.from({length: full.length / 3}, (_, t) => [Array.from(full.slice(t * 3, t * 3 + 3)).join(','), t])));
    }
    const camera = avatar.stage.camera, ray = new Raycaster(), vertex = new Vector3();
    const hitData = hit => {
        const mesh = hit.object, tri = [hit.face.a, hit.face.b, hit.face.c];
        const posed = tri.map(i => mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld).clone());
        const normal = posed[1].clone().sub(posed[0]).cross(posed[2].clone().sub(posed[0])).normalize();
        return {id: ids.get(mesh), distance: hit.distance, point: hit.point.toArray(),
            triangle: maps.get(mesh).get(tri.join(',')), vertices: tri,
            facingDot: normal.dot(ray.ray.direction), posed: posed.map(p => p.toArray())};
    };
    const cast = () => points.map(pixel => {
        ray.setFromCamera(new Vector2(2 * pixel.x / 754 - 1, 1 - 2 * pixel.y / 918), camera);
        return {pixel, hits: ray.intersectObjects(objects, false).slice(0, 6).map(hitData)};
    });
    const current = cast(), cloth = wardrobe.wornMeshes.get('female_casualsuit01');
    const originalSide = cloth.material.side;
    let doubleSided;
    try { cloth.material.side = DoubleSide; doubleSided = cast(); }
    finally { cloth.material.side = originalSide; }
    const body = avatar.figure.body.geometry, originalIndex = body.index.array.slice(), range = {...body.drawRange};
    let fullBody;
    try {
        body.index.array.set(wardrobe.fullIndex); body.setDrawRange(0, wardrobe.fullIndex.length);
        fullBody = cast();
    } finally { body.index.array.set(originalIndex); body.setDrawRange(range.start, range.count); }
    return {scope: 'CPU skinned triangle picking; excludes GPU-deformed hair, temporal filtering and shadowing.', originalSide, current, doubleSided, fullBody};
}
