import { Vector3 } from 'three';

// A visible gutter around the measured neutral head and head-region authored cards. This is a
// composition margin in CSS pixels, not an assumed head size or a device-specific zoom factor.
const EDGE_GUTTER_PIXELS = 16;

export function portraitFitZoom(bounds, width, height, aspect = width / height) {
    if (!(width > 0 && height > 0)) return 1;
    const horizontal = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX));
    const vertical = Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY));
    const safeX = Math.max(.1, 1 - 2 * EDGE_GUTTER_PIXELS / width);
    const safeY = Math.max(.1, 1 - 2 * EDGE_GUTTER_PIXELS / height);
    return Math.min(1, safeX * aspect / horizontal, safeY / vertical);
}

/** Clear residual input through OrbitControls' public update path before an explicit view reset. */
export function flushOrbitDamping(controls) {
    const damping = controls.enableDamping;
    controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
}

function neutralPortraitPoints(avatar) {
    const figure = avatar.figure, body = figure.body, points = [];
    figure.root.updateMatrixWorld(true); body.skeleton.update();
    const head = figure.humanoidBones.head;
    const headBones = new Set(body.skeleton.bones.flatMap((bone, index) => {
        for (let parent = bone; parent; parent = parent.parent) if (parent === head) return [index];
        return [];
    }));
    const indices = body.geometry.getAttribute('skinIndex'), weights = body.geometry.getAttribute('skinWeight');
    for (let i = 0; i < body.geometry.attributes.position.count; i++) {
        let weight = 0;
        for (let component = 0; component < 4; component++) if (headBones.has(indices.getComponent(i, component)))
            weight += weights.getComponent(i, component);
        if (weight >= .5) points.push(body.getVertexPosition(i, new Vector3()).applyMatrix4(body.matrixWorld));
    }
    const skinCount = points.length, headFloorY = Math.min(...points.map(point => point.y));
    let includedCardVertices = 0, excludedLowerCardVertices = 0, cardEdgeIntersections = 0;
    // Fit the head region, including the crown. Long lower tails may leave the existing close
    // portrait crop. Include triangle/plane crossings so a slanted card cannot evade the bound
    // just because its lower endpoint is below the anatomical cutoff. Transparent card borders
    // are conservative; shader-deformed or animated excursions are not qualified by this bound.
    avatar.hairRoot?.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.skeleton?.update();
        const vertices = [];
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
            const point = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld); vertices.push(point);
            if (point.y >= headFloorY) { points.push(point); includedCardVertices++; }
            else excludedLowerCardVertices++;
        }
        const index = mesh.geometry.getIndex(), count = index?.count ?? vertices.length;
        for (let i = 0; i < count; i += 3) for (let edge = 0; edge < 3; edge++) {
            const a = vertices[index ? index.getX(i + edge) : i + edge];
            const b = vertices[index ? index.getX(i + (edge + 1) % 3) : i + (edge + 1) % 3];
            if ((a.y < headFloorY) !== (b.y < headFloorY)) {
                points.push(a.clone().lerp(b, (headFloorY - a.y) / (b.y - a.y))); cardEdgeIntersections++;
            }
        }
    });
    if (skinCount === 0) throw new Error('The portrait has no measurable head surface.');
    return { points, skinCount, headFloorY, includedCardVertices, excludedLowerCardVertices, cardEdgeIntersections };
}

/** Page-owned projection fitting; camera world position, lighting and motion owners stay fixed. */
export class ViewerFraming {
    constructor(avatar, controls, canvas) {
        this.camera = avatar.stage.camera; this.controls = controls; this.canvas = canvas;
        const { points, ...measurement } = neutralPortraitPoints(avatar);
        this.points = points; this.measurement = measurement; this.bounds = null; this.mode = null; this.viewport = null;
    }

    // Called only after a page explicitly chooses its canonical framing, never while orbiting.
    setFraming(mode) {
        this.mode = mode; this.viewport = null;
        if (mode === 'portrait') {
            const camera = this.camera.clone(); camera.zoom = 1; camera.aspect = 1;
            camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
            const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
            for (const point of this.points) {
                const projected = point.clone().project(camera);
                bounds.minX = Math.min(bounds.minX, projected.x); bounds.maxX = Math.max(bounds.maxX, projected.x);
                bounds.minY = Math.min(bounds.minY, projected.y); bounds.maxY = Math.max(bounds.maxY, projected.y);
            }
            this.bounds = bounds;
        }
        this.update();
    }

    update() {
        const { clientWidth: width, clientHeight: height } = this.canvas;
        // Use the renderer's actual aspect, which can differ slightly from integer CSS client
        // dimensions at fractional layout sizes. Include it so a later resize callback settles.
        const viewport = `${width}:${height}:${this.camera.aspect}`;
        if (viewport === this.viewport) return false;
        this.viewport = viewport;
        const zoom = this.mode === 'portrait' ? portraitFitZoom(this.bounds, width, height, this.camera.aspect) : 1;
        const changed = this.camera.zoom !== zoom;
        this.camera.zoom = zoom; this.controls.zoom0 = zoom;
        if (changed) this.camera.updateProjectionMatrix();
        return changed;
    }

    report() {
        return { mode: this.mode, zoom: this.camera.zoom, effectiveFov: this.camera.getEffectiveFOV(),
            boundsAtUnitAspect: this.bounds ? { ...this.bounds } : null, ...this.measurement,
            support: 'Neutral head skin and authored cards at or above its lower extent; lower tails excluded.',
            gutterPixels: EDGE_GUTTER_PIXELS };
    }
}
