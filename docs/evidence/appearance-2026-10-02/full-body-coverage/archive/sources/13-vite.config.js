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
        fs: { allow: [ repoRoot ] },

        // 🚩 LM STUDIO CANNOT BE REACHED FROM A BROWSER PAGE WITHOUT THIS, AND IT FAILS IN A WAY
        // THAT NO NODE-SIDE GATE CAN SEE. Punch-list 5.3 / 7.3.
        //
        // Measured 2026-08-16 against the live host, three probes:
        //
        //   GET  /v1/models          + Origin  -> 200, and **no Access-Control-Allow-Origin header**
        //   OPTIONS /v1/chat/completions       -> **400 Bad Request**, no CORS headers
        //   POST /v1/chat/completions + Origin -> 200, and again no Access-Control-Allow-Origin
        //
        // A POST carrying `Content-Type: application/json` is not a CORS-simple request, so the
        // browser MUST send the preflight — which is the 400 — and would refuse to read the reply
        // anyway for want of the allow-origin header. `LMStudioClient`'s own gate passes at 55/55
        // against Node's `fetch`, which does not enforce CORS at all, so the gate is STRUCTURALLY
        // BLIND to the one thing that breaks this in the browser the avatar actually runs in.
        // LEARNINGS §1.11: a check that cannot observe the failure mode is not a check on it.
        //
        // The proxy makes the call SAME-ORIGIN from the page's point of view, so no preflight is
        // ever sent and no allow-origin header is ever needed. `changeOrigin` rewrites the Host
        // header, which LM Studio does not care about but a future gateway would.
        //
        // ⚠️ THIS IS A DEV-SERVER FACILITY AND IT DOES NOT SHIP. A built page served from anywhere
        // else has no proxy, which is why `LMStudioClient` takes `endpoint` as a constructor option
        // rather than hard-coding one: an embedder points it at their own same-origin path or at a
        // CORS-enabled gateway. `LM_STUDIO_PROXY_PATH` is exported beside the client so the page
        // and this file cannot disagree about the string.
        proxy: {
            '/lmstudio': {
                target: 'http://127.0.0.1:1234',
                changeOrigin: true,
                rewrite: ( path ) => path.replace( /^\/lmstudio/, '' )
            }
        }
    },

    build: {
        outDir: fileURLToPath( new URL( 'dist', import.meta.url ) ),
        emptyOutDir: true,
        // WebGPU implies a modern browser anyway; no point down-levelling the output.
        target: 'esnext'
    }

} );
