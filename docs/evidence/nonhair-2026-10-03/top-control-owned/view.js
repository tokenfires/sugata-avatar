import * as THREE from 'three';
const require = (value, message) => { if (!value) throw new Error(message); };
async function setup() {
    const owner = window.__TOP_OWNER = { geometry: null, material: null, renderer: null, mesh: null, scene: null, disposed: false, geometryEvents: 0, materialEvents: 0,
        dispose() {
            if (this.disposed) return this.receipt;
            const errors = [];
            const retire = (name, fn) => { try { fn(); } catch (e) { errors.push({ name, message: e.stack ?? e.message }); } };
            if (this.scene && this.mesh) retire('remove mesh', () => this.scene.remove(this.mesh));
            if (this.geometry) retire('geometry', () => this.geometry.dispose());
            if (this.material) retire('material', () => this.material.dispose());
            if (this.renderer) retire('renderer', () => this.renderer.dispose());
            this.disposed = true;
            return this.receipt = { disposed: errors.length === 0, geometryEvents: this.geometryEvents, materialEvents: this.materialEvents,
                returnedResources: { geometry: !!this.geometry, material: !!this.material, renderer: !!this.renderer, mesh: !!this.mesh }, errors,
                geometryUUID: this.geometry?.uuid ?? null, materialUUID: this.material?.uuid ?? null,
                sceneHasMesh: this.scene && this.mesh ? this.scene.children.includes(this.mesh) : false,
                rendererMemory: this.renderer ? { ...this.renderer.info.memory } : null };
        }
    };
    const dataURL = new URLSearchParams(location.search).get('data');
    require(dataURL?.startsWith('/@fs/'), 'explicit local source-control URL');
    const response = await fetch(dataURL); require(response.ok, 'source-control response');
    const control = await response.json(); require(!owner.disposed, 'source owner stopped');
    require(control.sourceVertices.length === 1250 && control.faces.length === 1204, 'observed source counts');
    const positions = [], uvs = [], owners = [];
    for (const face of control.faces) for (const fan of [[0, 1, 2], [0, 2, 3]]) for (const k of fan) {
        const [v, t] = face.corners[k];
        positions.push(...control.sourceVertices[v].xyz); uvs.push(...control.sourceUV[t]);
        owners.push({ sourceFace: face.sourceFace, sourceVertex: control.sourceVertices[v].sourceVertex, sourceUV: control.sourceUVIds[t], corner: k });
    }
    require(positions.length === 2408 * 9 && uvs.length === 2408 * 6, 'complete source fans');
    const geometry = owner.geometry = new THREE.BufferGeometry();
    geometry.addEventListener('dispose', () => owner.geometryEvents++);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
    let maxPositionError = 0;
    const actual = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i++) {
        require(Number.isFinite(actual[i]), 'finite position'); maxPositionError = Math.max(maxPositionError, Math.abs(positions[i] - actual[i]));
    }
    require(maxPositionError <= 2e-6, 'source-to-Float32 position bound');
    require([...geometry.attributes.normal.array].every(Number.isFinite), 'finite normals');
    const material = owner.material = new THREE.MeshStandardMaterial({ color: '#8d96a2', roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true });
    material.addEventListener('dispose', () => owner.materialEvents++);
    const mesh = owner.mesh = new THREE.Mesh(geometry, material), scene = owner.scene = new THREE.Scene(); scene.background = new THREE.Color('#f1f0ec'); scene.add(mesh);
    scene.add(new THREE.AmbientLight('#ffffff', 1.1));
    for (const [position, intensity] of [[[-10, 15, 20], 2.2], [[10, 10, -15], 1.4]]) {
        const light = new THREE.DirectionalLight('#ffffff', intensity); light.position.fromArray(position); scene.add(light);
    }
    const renderer = owner.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(1); renderer.setSize(900, 900);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; document.body.append(renderer.domElement);
    const gl = renderer.getContext(); require(gl instanceof WebGL2RenderingContext, 'actual WebGL2 context');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const environment = { version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null, attributes: gl.getContextAttributes(), threeRevision: THREE.REVISION };
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    const center = new THREE.Vector3(...control.originalBounds.minimum).add(new THREE.Vector3(...control.originalBounds.maximum)).multiplyScalar(.5);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const directions = [[0, 0, 1], [0, 0, -1], [1, .35, 1], [-1, .35, -1]];
    const labels = ['plus-Z', 'minus-Z', 'plus-X-plus-Z-oblique', 'minus-X-minus-Z-oblique'];
    window.__TOP = {
        capture(index) {
            require(!owner.disposed && Number.isInteger(index) && index >= 0 && index < 4, 'live declared view');
            camera.position.copy(center).addScaledVector(new THREE.Vector3(...directions[index]).normalize(), 30); camera.lookAt(center); camera.updateMatrixWorld(true);
            let maximum = 0;
            for (let i = 0; i < actual.length; i += 3) {
                const p = new THREE.Vector3(actual[i], actual[i + 1], actual[i + 2]).applyMatrix4(camera.matrixWorldInverse);
                maximum = Math.max(maximum, Math.abs(p.x), Math.abs(p.y));
            }
            const half = maximum * 1.10; require(Number.isFinite(half) && half > 0, 'finite complete-frame extent');
            camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
            const minimum = [Infinity, Infinity, Infinity], maximumNDC = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < actual.length; i += 3) {
                const p = new THREE.Vector3(actual[i], actual[i + 1], actual[i + 2]).project(camera);
                require([p.x, p.y, p.z].every(Number.isFinite) && Math.abs(p.x) <= 1 / 1.1 + 1e-6 && Math.abs(p.y) <= 1 / 1.1 + 1e-6 && Math.abs(p.z) < 1, 'whole source in frustum');
                [p.x, p.y, p.z].forEach((v, a) => { minimum[a] = Math.min(minimum[a], v); maximumNDC[a] = Math.max(maximumNDC[a], v); });
            }
            renderer.render(scene, camera); const png = renderer.domElement.toDataURL('image/png');
            require(gl.getError() === gl.NO_ERROR, 'GL render error');
            return { png, label: labels[index], direction: directions[index], observedUTC: new Date().toISOString(), environment,
                geometry: { positions: Array.from(actual), normals: Array.from(geometry.attributes.normal.array), uv: Array.from(geometry.attributes.uv.array), owners, index: geometry.index, maxPositionError },
                modelMatrix: mesh.matrixWorld.toArray(), bbox: { minimum: box.min.toArray(), maximum: box.max.toArray() },
                material: { colour: material.color.getHexString(), roughness: material.roughness, metalness: material.metalness, side: material.side, flatShading: material.flatShading, map: material.map },
                lights: scene.children.filter(o => o.isLight).map(o => ({ type: o.type, colour: o.color.getHexString(), intensity: o.intensity, position: o.position.toArray(), target: o.target?.position.toArray() ?? null })),
                camera: { center: center.toArray(), position: camera.position.toArray(), matrixWorld: camera.matrixWorld.toArray(), inverse: camera.matrixWorldInverse.toArray(), projection: camera.projectionMatrix.toArray(), half, near: camera.near, far: camera.far, zoom: camera.zoom },
                ndc: { minimum, maximum: maximumNDC }, draw: { ...renderer.info.render }, size: { width: renderer.domElement.width, height: renderer.domElement.height } };
        },
        dispose() { return owner.dispose(); }
    };
    window.__TOP_READY = true;
}
setup().catch(e => { window.__TOP_ERROR = e.stack ?? e.message; console.error(e); });
