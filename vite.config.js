import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = fileURLToPath( new URL( '.', import.meta.url ) );

export default defineConfig( {

    // The testbed is the app; packages/core is a plain source directory imported from it.
    root: 'packages/testbed',

    // No 'three' -> 'three/webgpu' alias here, deliberately.
    //
    // It looks like it should be needed — addons import bare 'three' — but in r185 both
    // build/three.module.js and build/three.webgpu.js re-export from a shared build/three.core.js,
    // so there is only ever one class instance. Verified: `Vector3 from 'three' === Vector3 from
    // 'three/webgpu'` is true with no alias, and the built bundle is byte-identical either way.
    //
    // Adding the alias is actively harmful. 'three/webgpu' does not export ShaderChunk,
    // ShaderLib, UniformsLib, UniformsUtils, WebGLCubeRenderTarget, WebGLRenderer or WebGLUtils,
    // and 30+ stock addons import those — Sky, Water, Reflector, Refractor among them. Aliasing
    // turns the first such import into a MISSING_EXPORT build failure that points at three.js
    // rather than at this file.

    server: {
        // The dev root sits two levels down; the server still has to serve packages/core.
        fs: { allow: [ repoRoot ] }
    },

    build: {
        outDir: fileURLToPath( new URL( 'dist', import.meta.url ) ),
        emptyOutDir: true,
        // WebGPU implies a modern browser anyway; no point down-levelling the output.
        target: 'esnext'
    }

} );
