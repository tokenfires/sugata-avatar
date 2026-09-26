// Exact unmeasured startup-v4 witness. Source/text changes require a fresh diagnosis.
export const STARTUP_FIXTURE = {
  "reportSHA256": "6de56b8c3f9c316255407a026478d996e4cecff35e903c3d3329b8ac2447fb15",
  "pageName": "showcase",
  "sourcePins": {
    "packages/core/src/figure/Figure.js": "5884d1ef68bb904271bcb2029bc1e50938381eded5ddfc187b431bcaf18cd3da",
    "packages/core/src/motion/HairDynamics.js": "bacd260ab768277b4efa9345c990e58a133c3c97f6b683ecf1674cc3588de1bc",
    "packages/core/src/wardrobe/Wardrobe.js": "d890af1ff1f26eb836d59f2dc83137a3d414a59fe027186494d5bfc62aa9aa14",
    "packages/core/src/render/CardRenderHistory.js": "3b67d5621c0a2f3084f5c23032bc73e1618e49efcc54dcc8f7ec96ac64869d2f",
    "packages/core/src/render/HairCardFrame.js": "c2af67e5ff6ca002a52d84de2a02919be55b11f863abc920e48fb29a0981ec83",
    "packages/core/src/Avatar.js": "62b48da266bf7a10fe41c4cd71c0326cfc3d65cc4e1475a973b7bbbc47f990d2",
    "node_modules/three/src/nodes/core/Node.js": "0720d248724842ffb5dbefc14b2ccfd26a5f7ec18136bed0a6d7ad3c93303dda",
    "node_modules/three/src/nodes/math/ConditionalNode.js": "323394ddbe991b6dc905cc7c740dc479b32476fcc7fdd7e053de904c0c910dc3",
    "node_modules/three/src/renderers/webgpu/WebGPUBackend.js": "ffd7f720c3cbbe4c6ec9757dd73b003fa340b1c2e40ccf4be131b6025a649e31"
  },
  "messages": [
    "Figure: this rig has no jaw, eyeLeft, eyeRight bone(s) (53 bones found). Motion layers that need them must fall back — jaw to the jawOpen morph, gaze to the eyeLook* morphs.",
    "Calling [RenderPassEncoder (unlabeled)].Draw with an index count of 0 is unusual.",
    "THREE.TSL: Return statement used in an inline 'Fn()'. Define a layout struct to allow return values. \"    at new StackTrace (http://localhost:5391/()\" at \"three_webgpu.js:510\"\n    at     at new StackTrace (http://localhost:5391/ (three_webgpu.js:510:80)\n    at     at new Node (http://localhost:5391/ (three_webgpu.js:997:58)\n    at     at new ConditionalNode (http://localhost:5391/ (three_webgpu.js:5316:3)\n    at     at fn (http://localhost:5391/ (three_webgpu.js:2439:21)\n    at     at StackNode.If (http://localhost:5391/ (three_webgpu.js:23642:23)\n    at     at If (http://localhost:5391/ (three_webgpu.js:2812:38)\n    at     at http://localhost:5391/ (HairDynamics.js:770:13)\n    at     at ShaderCallNodeInternal.call (http://localhost:5391/ (three_webgpu.js:2523:61)\n    at     at ShaderCallNodeInternal.setupOutput (http://localhost:5391/ (three_webgpu.js:2532:35)\n    at     at ShaderCallNodeInternal.getOutputNode (http://localhost:5391/ (three_webgpu.js:2538:67)",
    "THREE.TSL: Return statement used in an inline 'Fn()'. Define a layout struct to allow return values. \"    at new StackTrace (http://localhost:5391/()\" at \"three_webgpu.js:510\"\n    at     at new StackTrace (http://localhost:5391/ (three_webgpu.js:510:80)\n    at     at new Node (http://localhost:5391/ (three_webgpu.js:997:58)\n    at     at new ConditionalNode (http://localhost:5391/ (three_webgpu.js:5316:3)\n    at     at fn (http://localhost:5391/ (three_webgpu.js:2439:21)\n    at     at StackNode.If (http://localhost:5391/ (three_webgpu.js:23642:23)\n    at     at If (http://localhost:5391/ (three_webgpu.js:2812:38)\n    at     at http://localhost:5391/ (HairDynamics.js:778:13)\n    at     at ShaderCallNodeInternal.call (http://localhost:5391/ (three_webgpu.js:2523:61)\n    at     at ShaderCallNodeInternal.setupOutput (http://localhost:5391/ (three_webgpu.js:2532:35)\n    at     at ShaderCallNodeInternal.getOutputNode (http://localhost:5391/ (three_webgpu.js:2538:67)"
  ],
  "meshes": [
    {
      "name": "backdrop",
      "visible": true,
      "vertices": 4,
      "indices": 6,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "",
          "type": "MeshStandardNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "ground",
      "visible": true,
      "vertices": 4,
      "indices": 6,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "",
          "type": "MeshStandardNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Human",
      "visible": true,
      "vertices": 14517,
      "indices": 80268,
      "drawRange": {
        "start": 0,
        "count": 51036
      },
      "groups": [],
      "materials": [
        {
          "name": "",
          "type": "SkinNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humancornea",
      "visible": true,
      "vertices": 524,
      "indices": 2940,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.cornea",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humaneyebrow001",
      "visible": true,
      "vertices": 124,
      "indices": 576,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.card.Human.eyebrow001",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humaneyelashes01",
      "visible": true,
      "vertices": 250,
      "indices": 1104,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.card.Human.eyelashes01",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humanhigh-poly",
      "visible": true,
      "vertices": 552,
      "indices": 3180,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.globe",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humanteeth_base",
      "visible": true,
      "vertices": 4494,
      "indices": 21360,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "Human.teeth_base",
          "type": "MeshStandardMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humantongue01",
      "visible": true,
      "vertices": 253,
      "indices": 1344,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "Human.tongue01",
          "type": "MeshStandardMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "eyeOcclusion.left",
      "visible": true,
      "vertices": 1095,
      "indices": 6048,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.occlusion",
          "type": "MeshBasicNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "eyeLacrimal.left",
      "visible": true,
      "vertices": 660,
      "indices": 3612,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.lacrimal",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "eyeOcclusion.right",
      "visible": true,
      "vertices": 1095,
      "indices": 6048,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.occlusion",
          "type": "MeshBasicNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "eyeLacrimal.right",
      "visible": true,
      "vertices": 660,
      "indices": 3612,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.eye.lacrimal",
          "type": "MeshPhysicalNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "garment_foundation_bra",
      "visible": true,
      "vertices": 12030,
      "indices": 66270,
      "drawRange": {
        "start": 0,
        "count": 981
      },
      "groups": [],
      "materials": [
        {
          "name": "foundation_bra",
          "type": "MeshStandardMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "garment_foundation_briefs",
      "visible": true,
      "vertices": 6802,
      "indices": 37494,
      "drawRange": {
        "start": 0,
        "count": 0
      },
      "groups": [],
      "materials": [
        {
          "name": "foundation_briefs",
          "type": "MeshStandardMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "garment_female_casualsuit01",
      "visible": true,
      "vertices": 2377,
      "indices": 12708,
      "drawRange": {
        "start": 0,
        "count": 12708
      },
      "groups": [],
      "materials": [
        {
          "name": "wardrobe.ecru.female_casualsuit01",
          "type": "MeshStandardNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "garment_shoes01",
      "visible": true,
      "vertices": 1846,
      "indices": 9960,
      "drawRange": {
        "start": 0,
        "count": 9960
      },
      "groups": [],
      "materials": [
        {
          "name": "wardrobe.ecru.shoes01",
          "type": "MeshStandardNodeMaterial",
          "visible": true
        }
      ]
    },
    {
      "name": "Humanhair_bob02",
      "visible": true,
      "vertices": 17516,
      "indices": 51000,
      "drawRange": {
        "start": 0,
        "count": "Infinity"
      },
      "groups": [],
      "materials": [
        {
          "name": "sugata.hair",
          "type": "HairNodeMaterial",
          "visible": true
        }
      ]
    }
  ],
  "hair": {
    "style": "bob02",
    "loadedStyle": "bob02",
    "bake": "figure_g050",
    "unavailableReason": null,
    "attached": true,
    "meshes": 1,
    "oit": "stochastic",
    "stageReportsOit": "stochastic",
    "solver": {
      "chains": 496,
      "particles": 8432,
      "steps": 1
    },
    "velocityRepaired": true,
    "history": {
      "requested": "auto",
      "mode": "hold",
      "reason": "awaiting first beauty",
      "live": true,
      "valid": false,
      "commits": 0,
      "cachedDraws": 1,
      "invalidations": 0,
      "lastDraw": null,
      "cardVertexBase": 652,
      "cardVertexCount": 16864,
      "ownedHistoryBuffers": 1,
      "paddedHistoryBytes": 269824,
      "caps": "native hold; exact cards only"
    },
    "cardFrame": {
      "mode": "derivative",
      "available": true,
      "reason": "awaiting a draw",
      "live": true,
      "layout": {
        "base": 652,
        "count": 16864,
        "rings": 17,
        "cards": 496,
        "width": 0.123046875
      },
      "ownedBuffers": 0,
      "addedVertexBytes": 0
    },
    "bodyContact": null,
    "bodyContactUnavailableReason": null,
    "frameBudgetWarning": null,
    "undisposable": [
      "HairVelocity: installHairVelocity patches NodeMaterial.prototype.setupPosition process-wide with no uninstall (HairVelocity.js:162-183)"
    ]
  }
};
