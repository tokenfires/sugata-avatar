import { Color } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { vec3, vec4 } from 'three/tsl';

/** One isolated geometry ID pass, bypassing lighting, grade, bloom and temporal history. */
export async function drawGeometryMask(avatar) {
    const { scene, renderer, camera } = avatar.stage;
    const root = avatar.figure.root;
    const members = new Set();
    root.traverse(object => members.add(object));
    scene.traverse(object => {
        if (object.isMesh && !members.has(object)) object.visible = false;
    });
    root.traverse(object => {
        if (!object.isMesh) return;
        const masks = (Array.isArray(object.material) ? object.material : [object.material]).map(original => {
            const mask = new MeshBasicNodeMaterial({ color: 0xffffff, side: original.side,
                alphaTest: original.alphaTest, alphaToCoverage: original.alphaToCoverage,
                alphaHash: original.alphaHash, transparent: original.transparent,
                opacity: original.opacity, map: original.map, alphaMap: original.alphaMap });
            if (original.colorNode) mask.colorNode = vec4(vec3(1), original.colorNode.a);
            mask.opacityNode = original.opacityNode;
            mask.alphaTestNode = original.alphaTestNode;
            mask.positionNode = original.positionNode;
            mask.toneMapped = false;
            return mask;
        });
        object.material = Array.isArray(object.material) ? masks : masks[0];
    });
    scene.background = new Color(0x000000);
    scene.fog = null;
    scene.fogNode = null;
    renderer.setRenderTarget(null);
    renderer.setMRT(null);
    renderer.setClearColor(0x000000, 1);
    await renderer.renderAsync(scene, camera);
}
