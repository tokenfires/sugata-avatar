import { Ht as DepthTexture, Nn as HalfFloatType, Ps as Vector2, Yr as Matrix4, lo as RenderTarget } from "/@fs/Users/robault/GitHub/sugata-avatar/node_modules/.vite/deps/three.core-Ddh2Zg6B.js?v=da487242";
import { NodeMaterial, NodeUpdateType, QuadMesh, RendererUtils, TempNode } from "/@fs/Users/robault/GitHub/sugata-avatar/node_modules/.vite/deps/three_webgpu.js?v=da487242";
import { Fn, If, add, convertToTexture, exp, float, getViewPosition, ivec2, luminance, max, mix, outputStruct, passTexture, property, struct, texture, uniform, uv, vec2, vec4, velocity, viewZToPerspectiveDepth } from "/@fs/Users/robault/GitHub/sugata-avatar/node_modules/.vite/deps/three_tsl.js?v=da487242";
//#region node_modules/three/examples/jsm/tsl/display/TAAUNode.js
var _quadMesh = /*@__PURE__*/ new QuadMesh();
var _size = /*@__PURE__*/ new Vector2();
var _rendererState;
/**
* A special node that performs Temporal Anti-Aliasing Upscaling (TAAU).
*
* Like TRAA, the node accumulates jittered samples over multiple frames and
* reprojects history with motion vectors. Unlike TRAA, the input buffers
* (beauty, depth, velocity) are expected to be rendered at a lower resolution
* than the renderer's drawing buffer — typically by lowering the upstream
* pass's resolution via {@link PassNode#setResolutionScale} — and the resolve
* pass reconstructs an output-resolution image using a 9-tap Blackman-Harris
* filter (Gaussian approximation) over the jittered input samples. The result
* is an alternative to FSR2/3 that does anti-aliasing and upscaling in a
* single pass.
*
* References:
* - Karis, "High Quality Temporal Supersampling", SIGGRAPH 2014, {@link https://advances.realtimerendering.com/s2014/}
* - Riley/Arcila, FidelityFX Super Resolution 2, GDC 2022, {@link https://gpuopen.com/download/GDC_FidelityFX_Super_Resolution_2_0.pdf}
*
* Note: MSAA must be disabled when TAAU is in use.
*
* @augments TempNode
* @three_import import { taau } from 'three/addons/tsl/display/TAAUNode.js';
*/
var TAAUNode = class extends TempNode {
	static get type() {
		return "TAAUNode";
	}
	/**
	* Constructs a new TAAU node.
	*
	* @param {TextureNode} beautyNode - The texture node that represents the input of the effect.
	* @param {TextureNode} depthNode - A node that represents the scene's depth.
	* @param {TextureNode} velocityNode - A node that represents the scene's velocity.
	* @param {Camera} camera - The camera the scene is rendered with.
	*/
	constructor(beautyNode, depthNode, velocityNode, camera) {
		super("vec4");
		/**
		* This flag can be used for type testing.
		*
		* @type {boolean}
		* @readonly
		* @default true
		*/
		this.isTAAUNode = true;
		/**
		* The `updateBeforeType` is set to `NodeUpdateType.FRAME` since the node renders
		* its effect once per frame in `updateBefore()`.
		*
		* @type {string}
		* @default 'frame'
		*/
		this.updateBeforeType = NodeUpdateType.FRAME;
		/**
		* The texture node that represents the input of the effect.
		*
		* @type {TextureNode}
		*/
		this.beautyNode = beautyNode;
		/**
		* A node that represents the scene's depth.
		*
		* @type {TextureNode}
		*/
		this.depthNode = depthNode;
		/**
		* A node that represents the scene's velocity.
		*
		* @type {TextureNode}
		*/
		this.velocityNode = velocityNode;
		/**
		* The camera the scene is rendered with.
		*
		* @type {Camera}
		*/
		this.camera = camera;
		/**
		* When the difference between the current and previous depth goes above this threshold,
		* the history is considered invalid.
		*
		* @type {number}
		* @default 0.0005
		*/
		this.depthThreshold = 5e-4;
		/**
		* The depth difference within the 3×3 neighborhood to consider a pixel as an edge.
		*
		* @type {number}
		* @default 0.001
		*/
		this.edgeDepthDiff = .001;
		/**
		* The history becomes invalid as the pixel length of the velocity approaches this value.
		*
		* @type {number}
		* @default 128
		*/
		this.maxVelocityLength = 128;
		/**
		* Baseline weight applied to the current frame in the resolve. Lower
		* values produce smoother results with longer accumulation but slower
		* convergence on disoccluded regions; the motion factor is added on
		* top, so fast-moving pixels still respond quickly.
		*
		* @type {number}
		* @default 0.025
		*/
		this.currentFrameWeight = .025;
		/**
		* The jitter index selects the current camera offset value.
		*
		* @private
		* @type {number}
		* @default 0
		*/
		this._jitterIndex = 0;
		/**
		* A uniform node holding the current jitter offset in input-pixel
		* units. The shader needs this to know where each input sample was
		* actually rendered when computing per-tap reconstruction weights.
		*
		* @private
		* @type {UniformNode<vec2>}
		*/
		this._jitterOffset = uniform(new Vector2());
		/**
		* The render target that represents the history of frame data.
		* Sized to the renderer's drawing buffer (the output resolution).
		*
		* @private
		* @type {?RenderTarget}
		*/
		this._historyRenderTarget = new RenderTarget(1, 1, {
			depthBuffer: false,
			type: HalfFloatType,
			count: 2
		});
		this._historyRenderTarget.textures[0].name = "TAAUNode.history.color";
		this._historyRenderTarget.textures[1].name = "TAAUNode.history.lock";
		/**
		* The render target for the resolve. Sized to the renderer's drawing
		* buffer (the output resolution).
		*
		* @private
		* @type {?RenderTarget}
		*/
		this._resolveRenderTarget = new RenderTarget(1, 1, {
			depthBuffer: false,
			type: HalfFloatType
		});
		this._resolveRenderTarget.texture.name = "TAAUNode.resolve";
		/**
		* Render target whose depth attachment holds the previous frame's
		* depth buffer. The depth texture must be owned by a render target
		* so that `copyTextureToTexture` can copy into it on the WebGL
		* backend, which uses a framebuffer blit and therefore needs the
		* destination depth texture to be attached to a framebuffer. This
		* render target is sized independently of the history target so it
		* can match the (lower-resolution) input depth texture.
		*
		* @private
		* @type {RenderTarget}
		*/
		this._previousDepthRenderTarget = new RenderTarget(1, 1, {
			depthBuffer: false,
			depthTexture: new DepthTexture()
		});
		this._previousDepthRenderTarget.depthTexture.name = "TAAUNode.previousDepth";
		/**
		* Material used for the resolve step.
		*
		* @private
		* @type {NodeMaterial}
		*/
		this._resolveMaterial = new NodeMaterial();
		this._resolveMaterial.name = "TAAU.resolve";
		/**
		* Material used to seed the history render target on resize. It
		* performs a bilinear upscale of the current beauty buffer into the
		* output-sized history target so that the first frames after a
		* resize do not fade in from black.
		*
		* @private
		* @type {NodeMaterial}
		*/
		this._seedMaterial = new NodeMaterial();
		this._seedMaterial.name = "TAAU.seed";
		/**
		* The result of the effect is represented as a separate texture node.
		*
		* @private
		* @type {PassTextureNode}
		*/
		this._textureNode = passTexture(this, this._resolveRenderTarget.texture);
		/**
		* Used to save the original/unjittered projection matrix.
		*
		* @private
		* @type {Matrix4}
		*/
		this._originalProjectionMatrix = new Matrix4();
		/**
		* A uniform node holding the camera's near and far.
		*
		* @private
		* @type {UniformNode<vec2>}
		*/
		this._cameraNearFar = uniform(new Vector2());
		/**
		* A uniform node holding the camera world matrix.
		*
		* @private
		* @type {UniformNode<mat4>}
		*/
		this._cameraWorldMatrix = uniform(new Matrix4());
		/**
		* A uniform node holding the camera world matrix inverse.
		*
		* @private
		* @type {UniformNode<mat4>}
		*/
		this._cameraWorldMatrixInverse = uniform(new Matrix4());
		/**
		* A uniform node holding the camera projection matrix inverse.
		*
		* @private
		* @type {UniformNode<mat4>}
		*/
		this._cameraProjectionMatrixInverse = uniform(new Matrix4());
		/**
		* A uniform node holding the previous frame's view matrix.
		*
		* @private
		* @type {UniformNode<mat4>}
		*/
		this._previousCameraWorldMatrix = uniform(new Matrix4());
		/**
		* A uniform node holding the previous frame's projection matrix inverse.
		*
		* @private
		* @type {UniformNode<mat4>}
		*/
		this._previousCameraProjectionMatrixInverse = uniform(new Matrix4());
		/**
		* A texture node for the previous depth buffer.
		*
		* @private
		* @type {TextureNode}
		*/
		this._previousDepthNode = texture(this._previousDepthRenderTarget.depthTexture);
		/**
		* Sync the post processing stack with the TAAU node.
		*
		* @private
		* @type {boolean}
		*/
		this._needsPostProcessingSync = false;
	}
	/**
	* Returns the result of the effect as a texture node.
	*
	* @return {PassTextureNode} A texture node that represents the result of the effect.
	*/
	getTextureNode() {
		return this._textureNode;
	}
	/**
	* Sets the output size of the effect (history and resolve targets). The
	* previous-depth texture is sized independently in `updateBefore()` to
	* track the scene's current depth texture.
	*
	* @param {number} outputWidth - The output width (drawing buffer width).
	* @param {number} outputHeight - The output height (drawing buffer height).
	*/
	setSize(outputWidth, outputHeight) {
		this._historyRenderTarget.setSize(outputWidth, outputHeight);
		this._resolveRenderTarget.setSize(outputWidth, outputHeight);
	}
	/**
	* Defines the TAAU's current jitter as a view offset to the scene's
	* camera. The jitter is shrunk to one *output* pixel (rather than one
	* input pixel) so that the halton sequence gradually fills the output
	* sub-pixel grid over multiple frames.
	*
	* @param {number} inputWidth - The width of the input buffers the camera renders into.
	* @param {number} inputHeight - The height of the input buffers the camera renders into.
	*/
	setViewOffset(inputWidth, inputHeight) {
		this.camera.updateProjectionMatrix();
		this._originalProjectionMatrix.copy(this.camera.projectionMatrix);
		velocity.setProjectionMatrix(this._originalProjectionMatrix);
		const haltonOffset = _haltonOffsets[this._jitterIndex];
		const jitterX = haltonOffset[0] - .5;
		const jitterY = haltonOffset[1] - .5;
		this._jitterOffset.value.set(jitterX, jitterY);
		this.camera.setViewOffset(inputWidth, inputHeight, jitterX, jitterY, inputWidth, inputHeight);
	}
	/**
	* Clears the view offset from the scene's camera.
	*/
	clearViewOffset() {
		this.camera.clearViewOffset();
		velocity.setProjectionMatrix(null);
		this._jitterIndex++;
		this._jitterIndex = this._jitterIndex % (_haltonOffsets.length - 1);
	}
	/**
	* This method is used to render the effect once per frame.
	*
	* @param {NodeFrame} frame - The current node frame.
	*/
	updateBefore(frame) {
		const { renderer } = frame;
		this._previousCameraWorldMatrix.value.copy(this._cameraWorldMatrix.value);
		this._previousCameraProjectionMatrixInverse.value.copy(this._cameraProjectionMatrixInverse.value);
		this._cameraNearFar.value.set(this.camera.near, this.camera.far);
		this._cameraWorldMatrix.value.copy(this.camera.matrixWorld);
		this._cameraWorldMatrixInverse.value.copy(this.camera.matrixWorldInverse);
		this._cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
		const beautyRenderTarget = this.beautyNode.isRTTNode ? this.beautyNode.renderTarget : this.beautyNode.passNode.renderTarget;
		const inputWidth = beautyRenderTarget.texture.width;
		const inputHeight = beautyRenderTarget.texture.height;
		const drawingBufferSize = renderer.getDrawingBufferSize(_size);
		const outputWidth = drawingBufferSize.width;
		const outputHeight = drawingBufferSize.height;
		_rendererState = RendererUtils.resetRendererState(renderer, _rendererState);
		const needsRestart = this._historyRenderTarget.width !== outputWidth || this._historyRenderTarget.height !== outputHeight;
		this.setSize(outputWidth, outputHeight);
		if (needsRestart === true) {
			renderer.initRenderTarget(this._historyRenderTarget);
			renderer.initRenderTarget(this._resolveRenderTarget);
			renderer.setRenderTarget(this._historyRenderTarget);
			_quadMesh.material = this._seedMaterial;
			_quadMesh.name = "TAAU.seed";
			_quadMesh.render(renderer);
			renderer.setRenderTarget(null);
		}
		if (this._needsPostProcessingSync === true) {
			this.setViewOffset(inputWidth, inputHeight);
			this._needsPostProcessingSync = false;
		}
		renderer.setRenderTarget(this._resolveRenderTarget);
		_quadMesh.material = this._resolveMaterial;
		_quadMesh.name = "TAAU";
		_quadMesh.render(renderer);
		renderer.setRenderTarget(null);
		renderer.copyTextureToTexture(this._resolveRenderTarget.texture, this._historyRenderTarget.texture);
		const currentDepth = this.depthNode.value;
		const srcW = currentDepth.image !== null && currentDepth.image !== void 0 ? currentDepth.image.width : 0;
		const srcH = currentDepth.image !== null && currentDepth.image !== void 0 ? currentDepth.image.height : 0;
		if (srcW > 0 && srcH > 0) {
			if (this._previousDepthRenderTarget.width !== srcW || this._previousDepthRenderTarget.height !== srcH) {
				this._previousDepthRenderTarget.setSize(srcW, srcH);
				renderer.initRenderTarget(this._previousDepthRenderTarget);
			}
			const dstDepth = this._previousDepthRenderTarget.depthTexture;
			renderer.copyTextureToTexture(currentDepth, dstDepth);
			this._previousDepthNode.value = dstDepth;
		}
		RendererUtils.restoreRendererState(renderer, _rendererState);
	}
	/**
	* This method is used to setup the effect's render targets and TSL code.
	*
	* @param {NodeBuilder} builder - The current node builder.
	* @return {PassTextureNode}
	*/
	setup(builder) {
		const renderPipeline = builder.context.renderPipeline;
		if (renderPipeline) {
			this._needsPostProcessingSync = true;
			renderPipeline.context.onBeforeRenderPipeline = () => {
				const beautyRenderTarget = this.beautyNode.isRTTNode ? this.beautyNode.renderTarget : this.beautyNode.passNode.renderTarget;
				const inputWidth = beautyRenderTarget.texture.width;
				const inputHeight = beautyRenderTarget.texture.height;
				this.setViewOffset(inputWidth, inputHeight);
			};
			renderPipeline.context.onAfterRenderPipeline = () => {
				this.clearViewOffset();
			};
		}
		const currentDepthStruct = struct({
			closestDepth: "float",
			closestPositionTexel: "vec2",
			farthestDepth: "float"
		});
		const sampleCurrentDepth = Fn(([positionTexel]) => {
			const closestDepth = float(2).toVar();
			const closestPositionTexel = vec2(0).toVar();
			const farthestDepth = float(-1).toVar();
			for (let x = -1; x <= 1; ++x) for (let y = -1; y <= 1; ++y) {
				const neighbor = positionTexel.add(vec2(x, y)).toVar();
				const depth = this.depthNode.load(neighbor).r.toVar();
				If(depth.lessThan(closestDepth), () => {
					closestDepth.assign(depth);
					closestPositionTexel.assign(neighbor);
				});
				If(depth.greaterThan(farthestDepth), () => {
					farthestDepth.assign(depth);
				});
			}
			return currentDepthStruct(closestDepth, closestPositionTexel, farthestDepth);
		});
		const samplePreviousDepth = (uv) => {
			const depth = this._previousDepthNode.sample(uv).r;
			const positionView = getViewPosition(uv, depth, this._previousCameraProjectionMatrixInverse);
			const positionWorld = this._previousCameraWorldMatrix.mul(vec4(positionView, 1)).xyz;
			const viewZ = this._cameraWorldMatrixInverse.mul(vec4(positionWorld, 1)).z;
			return viewZToPerspectiveDepth(viewZ, this._cameraNearFar.x, this._cameraNearFar.y);
		};
		const clipAABB = Fn(([currentColor, historyColor, minColor, maxColor]) => {
			const pClip = maxColor.rgb.add(minColor.rgb).mul(.5);
			const eClip = maxColor.rgb.sub(minColor.rgb).mul(.5).add(1e-7);
			const vClip = historyColor.sub(vec4(pClip, currentColor.a));
			const absUnit = vClip.xyz.div(eClip).abs();
			const maxUnit = max(absUnit.x, absUnit.y, absUnit.z);
			return maxUnit.greaterThan(1).select(vec4(pClip, currentColor.a).add(vClip.div(maxUnit)), historyColor);
		}).setLayout({
			name: "clipAABB",
			type: "vec4",
			inputs: [
				{
					name: "currentColor",
					type: "vec4"
				},
				{
					name: "historyColor",
					type: "vec4"
				},
				{
					name: "minColor",
					type: "vec4"
				},
				{
					name: "maxColor",
					type: "vec4"
				}
			]
		});
		const flickerReduction = Fn(([currentColor, historyColor, currentWeight]) => {
			const historyWeight = currentWeight.oneMinus();
			const compressedCurrent = currentColor.mul(float(1).div(max(currentColor.r, currentColor.g, currentColor.b).add(1)));
			const compressedHistory = historyColor.mul(float(1).div(max(historyColor.r, historyColor.g, historyColor.b).add(1)));
			const luminanceCurrent = luminance(compressedCurrent.rgb);
			const luminanceHistory = luminance(compressedHistory.rgb);
			currentWeight.mulAssign(float(1).div(luminanceCurrent.add(1)));
			historyWeight.mulAssign(float(1).div(luminanceHistory.add(1)));
			return add(currentColor.mul(currentWeight), historyColor.mul(historyWeight)).div(max(currentWeight.add(historyWeight), 1e-5)).toVar();
		});
		const historyNode = texture(this._historyRenderTarget.textures[0]);
		const lockNode = texture(this._historyRenderTarget.textures[1]);
		const colorOutput = property("vec4");
		const lockOutput = property("vec4");
		const outputNode = outputStruct(colorOutput, lockOutput);
		const resolve = Fn(() => {
			const uvNode = uv();
			const inputSize = this.beautyNode.size();
			const inputSizeF = vec2(inputSize);
			const pIn = uvNode.mul(inputSizeF);
			const closestTapF = pIn.sub(vec2(.5).add(this._jitterOffset)).round();
			const closestTap = ivec2(closestTapF);
			const currentDepth = sampleCurrentDepth(closestTapF);
			const closestDepth = currentDepth.get("closestDepth");
			const closestPositionTexel = currentDepth.get("closestPositionTexel");
			const farthestDepth = currentDepth.get("farthestDepth");
			const offsetUV = this.velocityNode.load(closestPositionTexel).xy.mul(vec2(.5, -.5));
			const historyUV = uvNode.sub(offsetUV);
			const previousDepth = samplePreviousDepth(historyUV);
			const isValidUV = historyUV.greaterThanEqual(0).all().and(historyUV.lessThanEqual(1).all());
			const isEdge = farthestDepth.sub(closestDepth).greaterThan(this.edgeDepthDiff);
			const isDisocclusion = closestDepth.sub(previousDepth).greaterThan(this.depthThreshold);
			const hasValidHistory = isValidUV.and(isEdge.or(isDisocclusion.not()));
			const sumColor = vec4(0).toVar();
			const sumWeight = float(0).toVar();
			const moment1 = vec4(0).toVar();
			const moment2 = vec4(0).toVar();
			const offsets = [
				[-1, -1],
				[0, -1],
				[1, -1],
				[-1, 0],
				[0, 0],
				[1, 0],
				[-1, 1],
				[0, 1],
				[1, 1]
			];
			for (const [x, y] of offsets) {
				const tap = closestTap.add(ivec2(x, y));
				const tapCenter = vec2(tap).add(vec2(.5).add(this._jitterOffset));
				const delta = pIn.sub(tapCenter);
				const d2 = delta.dot(delta);
				const w = exp(d2.mul(-2.29));
				const c = this.beautyNode.load(tap).max(0);
				sumColor.addAssign(c.mul(w));
				sumWeight.addAssign(w);
				moment1.addAssign(c);
				moment2.addAssign(c.pow2());
			}
			const currentColor = sumColor.div(sumWeight.max(1e-5));
			const N = float(offsets.length);
			const mean = moment1.div(N);
			const motionFactor = uvNode.sub(historyUV).mul(inputSizeF).length().div(this.maxVelocityLength).saturate();
			const varianceGamma = mix(.5, 1, motionFactor.oneMinus().pow2());
			const variance = moment2.div(N).sub(mean.pow2()).max(0).sqrt().mul(varianceGamma);
			const minColor = mean.sub(variance);
			const maxColor = mean.add(variance);
			const historyColor = historyNode.sample(historyUV);
			const clippedHistoryColor = clipAABB(mean.clamp(minColor, maxColor), historyColor, minColor, maxColor);
			const currentLuma = luminance(currentColor.rgb);
			const meanLuma = luminance(mean.rgb).toConst();
			const thinFeature = currentLuma.sub(meanLuma).abs().div(meanLuma).smoothstep(0, .2);
			const isDepthChanged = closestDepth.sub(previousDepth).abs().greaterThan(this.depthThreshold);
			const gatedThinFeature = isValidUV.and(isDepthChanged.not()).select(thinFeature, float(0));
			const decay = isDisocclusion.select(0, .5);
			const lock = max(gatedThinFeature, lockNode.r.mul(decay)).saturate();
			const lockedHistoryColor = mix(clippedHistoryColor, historyColor, lock);
			const currentWeight = float(this.currentFrameWeight).toVar();
			currentWeight.assign(hasValidHistory.select(currentWeight.add(motionFactor).saturate(), 1));
			const output = flickerReduction(currentColor, lockedHistoryColor, currentWeight);
			colorOutput.assign(output);
			lockOutput.assign(lock);
			return vec4(0);
		});
		this._resolveMaterial.colorNode = resolve();
		this._resolveMaterial.outputNode = outputNode;
		this._seedMaterial.colorNode = Fn(() => {
			colorOutput.assign(this.beautyNode.sample(uv()));
			lockOutput.assign(0);
			return vec4(0);
		})();
		this._seedMaterial.outputNode = outputNode;
		return this._textureNode;
	}
	/**
	* Frees internal resources. This method should be called
	* when the effect is no longer required.
	*/
	dispose() {
		this._historyRenderTarget.dispose();
		this._resolveRenderTarget.dispose();
		this._previousDepthRenderTarget.dispose();
		this._resolveMaterial.dispose();
		this._seedMaterial.dispose();
	}
};
function _halton(index, base) {
	let fraction = 1;
	let result = 0;
	while (index > 0) {
		fraction /= base;
		result += fraction * (index % base);
		index = Math.floor(index / base);
	}
	return result;
}
var _haltonOffsets = /*@__PURE__*/ Array.from({ length: 32 }, (_, index) => [_halton(index + 1, 2), _halton(index + 1, 3)]);
/**
* TSL function for creating a TAAU node for Temporal Anti-Aliasing Upscaling.
*
* @tsl
* @function
* @param {TextureNode} beautyNode - The texture node that represents the input of the effect.
* @param {TextureNode} depthNode - A node that represents the scene's depth.
* @param {TextureNode} velocityNode - A node that represents the scene's velocity.
* @param {Camera} camera - The camera the scene is rendered with.
* @returns {TAAUNode}
*/
var taau = (beautyNode, depthNode, velocityNode, camera) => new TAAUNode(convertToTexture(beautyNode), depthNode, velocityNode, camera);
//#endregion
export { TAAUNode as default, taau };

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWVfYWRkb25zX3RzbF9kaXNwbGF5X1RBQVVOb2RlX19qcy5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi8uLi90aHJlZS9leGFtcGxlcy9qc20vdHNsL2Rpc3BsYXkvVEFBVU5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSGFsZkZsb2F0VHlwZSwgVmVjdG9yMiwgUmVuZGVyVGFyZ2V0LCBSZW5kZXJlclV0aWxzLCBRdWFkTWVzaCwgTm9kZU1hdGVyaWFsLCBUZW1wTm9kZSwgTm9kZVVwZGF0ZVR5cGUsIE1hdHJpeDQsIERlcHRoVGV4dHVyZSB9IGZyb20gJ3RocmVlL3dlYmdwdSc7XG5pbXBvcnQgeyBhZGQsIGV4cCwgZmxvYXQsIElmLCBGbiwgbWF4LCB0ZXh0dXJlLCB1bmlmb3JtLCB1diwgdmVjMiwgdmVjNCwgbHVtaW5hbmNlLCBjb252ZXJ0VG9UZXh0dXJlLCBwYXNzVGV4dHVyZSwgdmVsb2NpdHksIGdldFZpZXdQb3NpdGlvbiwgdmlld1pUb1BlcnNwZWN0aXZlRGVwdGgsIHN0cnVjdCwgaXZlYzIsIG1peCwgcHJvcGVydHksIG91dHB1dFN0cnVjdCB9IGZyb20gJ3RocmVlL3RzbCc7XG5cbmNvbnN0IF9xdWFkTWVzaCA9IC8qQF9fUFVSRV9fKi8gbmV3IFF1YWRNZXNoKCk7XG5jb25zdCBfc2l6ZSA9IC8qQF9fUFVSRV9fKi8gbmV3IFZlY3RvcjIoKTtcblxubGV0IF9yZW5kZXJlclN0YXRlO1xuXG5cbi8qKlxuICogQSBzcGVjaWFsIG5vZGUgdGhhdCBwZXJmb3JtcyBUZW1wb3JhbCBBbnRpLUFsaWFzaW5nIFVwc2NhbGluZyAoVEFBVSkuXG4gKlxuICogTGlrZSBUUkFBLCB0aGUgbm9kZSBhY2N1bXVsYXRlcyBqaXR0ZXJlZCBzYW1wbGVzIG92ZXIgbXVsdGlwbGUgZnJhbWVzIGFuZFxuICogcmVwcm9qZWN0cyBoaXN0b3J5IHdpdGggbW90aW9uIHZlY3RvcnMuIFVubGlrZSBUUkFBLCB0aGUgaW5wdXQgYnVmZmVyc1xuICogKGJlYXV0eSwgZGVwdGgsIHZlbG9jaXR5KSBhcmUgZXhwZWN0ZWQgdG8gYmUgcmVuZGVyZWQgYXQgYSBsb3dlciByZXNvbHV0aW9uXG4gKiB0aGFuIHRoZSByZW5kZXJlcidzIGRyYXdpbmcgYnVmZmVyIOKAlCB0eXBpY2FsbHkgYnkgbG93ZXJpbmcgdGhlIHVwc3RyZWFtXG4gKiBwYXNzJ3MgcmVzb2x1dGlvbiB2aWEge0BsaW5rIFBhc3NOb2RlI3NldFJlc29sdXRpb25TY2FsZX0g4oCUIGFuZCB0aGUgcmVzb2x2ZVxuICogcGFzcyByZWNvbnN0cnVjdHMgYW4gb3V0cHV0LXJlc29sdXRpb24gaW1hZ2UgdXNpbmcgYSA5LXRhcCBCbGFja21hbi1IYXJyaXNcbiAqIGZpbHRlciAoR2F1c3NpYW4gYXBwcm94aW1hdGlvbikgb3ZlciB0aGUgaml0dGVyZWQgaW5wdXQgc2FtcGxlcy4gVGhlIHJlc3VsdFxuICogaXMgYW4gYWx0ZXJuYXRpdmUgdG8gRlNSMi8zIHRoYXQgZG9lcyBhbnRpLWFsaWFzaW5nIGFuZCB1cHNjYWxpbmcgaW4gYVxuICogc2luZ2xlIHBhc3MuXG4gKlxuICogUmVmZXJlbmNlczpcbiAqIC0gS2FyaXMsIFwiSGlnaCBRdWFsaXR5IFRlbXBvcmFsIFN1cGVyc2FtcGxpbmdcIiwgU0lHR1JBUEggMjAxNCwge0BsaW5rIGh0dHBzOi8vYWR2YW5jZXMucmVhbHRpbWVyZW5kZXJpbmcuY29tL3MyMDE0L31cbiAqIC0gUmlsZXkvQXJjaWxhLCBGaWRlbGl0eUZYIFN1cGVyIFJlc29sdXRpb24gMiwgR0RDIDIwMjIsIHtAbGluayBodHRwczovL2dwdW9wZW4uY29tL2Rvd25sb2FkL0dEQ19GaWRlbGl0eUZYX1N1cGVyX1Jlc29sdXRpb25fMl8wLnBkZn1cbiAqXG4gKiBOb3RlOiBNU0FBIG11c3QgYmUgZGlzYWJsZWQgd2hlbiBUQUFVIGlzIGluIHVzZS5cbiAqXG4gKiBAYXVnbWVudHMgVGVtcE5vZGVcbiAqIEB0aHJlZV9pbXBvcnQgaW1wb3J0IHsgdGFhdSB9IGZyb20gJ3RocmVlL2FkZG9ucy90c2wvZGlzcGxheS9UQUFVTm9kZS5qcyc7XG4gKi9cbmNsYXNzIFRBQVVOb2RlIGV4dGVuZHMgVGVtcE5vZGUge1xuXG5cdHN0YXRpYyBnZXQgdHlwZSgpIHtcblxuXHRcdHJldHVybiAnVEFBVU5vZGUnO1xuXG5cdH1cblxuXHQvKipcblx0ICogQ29uc3RydWN0cyBhIG5ldyBUQUFVIG5vZGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7VGV4dHVyZU5vZGV9IGJlYXV0eU5vZGUgLSBUaGUgdGV4dHVyZSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgaW5wdXQgb2YgdGhlIGVmZmVjdC5cblx0ICogQHBhcmFtIHtUZXh0dXJlTm9kZX0gZGVwdGhOb2RlIC0gQSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgc2NlbmUncyBkZXB0aC5cblx0ICogQHBhcmFtIHtUZXh0dXJlTm9kZX0gdmVsb2NpdHlOb2RlIC0gQSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgc2NlbmUncyB2ZWxvY2l0eS5cblx0ICogQHBhcmFtIHtDYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgdGhlIHNjZW5lIGlzIHJlbmRlcmVkIHdpdGguXG5cdCAqL1xuXHRjb25zdHJ1Y3RvciggYmVhdXR5Tm9kZSwgZGVwdGhOb2RlLCB2ZWxvY2l0eU5vZGUsIGNhbWVyYSApIHtcblxuXHRcdHN1cGVyKCAndmVjNCcgKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoaXMgZmxhZyBjYW4gYmUgdXNlZCBmb3IgdHlwZSB0ZXN0aW5nLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUge2Jvb2xlYW59XG5cdFx0ICogQHJlYWRvbmx5XG5cdFx0ICogQGRlZmF1bHQgdHJ1ZVxuXHRcdCAqL1xuXHRcdHRoaXMuaXNUQUFVTm9kZSA9IHRydWU7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYHVwZGF0ZUJlZm9yZVR5cGVgIGlzIHNldCB0byBgTm9kZVVwZGF0ZVR5cGUuRlJBTUVgIHNpbmNlIHRoZSBub2RlIHJlbmRlcnNcblx0XHQgKiBpdHMgZWZmZWN0IG9uY2UgcGVyIGZyYW1lIGluIGB1cGRhdGVCZWZvcmUoKWAuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSB7c3RyaW5nfVxuXHRcdCAqIEBkZWZhdWx0ICdmcmFtZSdcblx0XHQgKi9cblx0XHR0aGlzLnVwZGF0ZUJlZm9yZVR5cGUgPSBOb2RlVXBkYXRlVHlwZS5GUkFNRTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSB0ZXh0dXJlIG5vZGUgdGhhdCByZXByZXNlbnRzIHRoZSBpbnB1dCBvZiB0aGUgZWZmZWN0LlxuXHRcdCAqXG5cdFx0ICogQHR5cGUge1RleHR1cmVOb2RlfVxuXHRcdCAqL1xuXHRcdHRoaXMuYmVhdXR5Tm9kZSA9IGJlYXV0eU5vZGU7XG5cblx0XHQvKipcblx0XHQgKiBBIG5vZGUgdGhhdCByZXByZXNlbnRzIHRoZSBzY2VuZSdzIGRlcHRoLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUge1RleHR1cmVOb2RlfVxuXHRcdCAqL1xuXHRcdHRoaXMuZGVwdGhOb2RlID0gZGVwdGhOb2RlO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgc2NlbmUncyB2ZWxvY2l0eS5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIHtUZXh0dXJlTm9kZX1cblx0XHQgKi9cblx0XHR0aGlzLnZlbG9jaXR5Tm9kZSA9IHZlbG9jaXR5Tm9kZTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBjYW1lcmEgdGhlIHNjZW5lIGlzIHJlbmRlcmVkIHdpdGguXG5cdFx0ICpcblx0XHQgKiBAdHlwZSB7Q2FtZXJhfVxuXHRcdCAqL1xuXHRcdHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG5cdFx0LyoqXG5cdFx0ICogV2hlbiB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBjdXJyZW50IGFuZCBwcmV2aW91cyBkZXB0aCBnb2VzIGFib3ZlIHRoaXMgdGhyZXNob2xkLFxuXHRcdCAqIHRoZSBoaXN0b3J5IGlzIGNvbnNpZGVyZWQgaW52YWxpZC5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIHtudW1iZXJ9XG5cdFx0ICogQGRlZmF1bHQgMC4wMDA1XG5cdFx0ICovXG5cdFx0dGhpcy5kZXB0aFRocmVzaG9sZCA9IDAuMDAwNTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBkZXB0aCBkaWZmZXJlbmNlIHdpdGhpbiB0aGUgM8OXMyBuZWlnaGJvcmhvb2QgdG8gY29uc2lkZXIgYSBwaXhlbCBhcyBhbiBlZGdlLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUge251bWJlcn1cblx0XHQgKiBAZGVmYXVsdCAwLjAwMVxuXHRcdCAqL1xuXHRcdHRoaXMuZWRnZURlcHRoRGlmZiA9IDAuMDAxO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGhpc3RvcnkgYmVjb21lcyBpbnZhbGlkIGFzIHRoZSBwaXhlbCBsZW5ndGggb2YgdGhlIHZlbG9jaXR5IGFwcHJvYWNoZXMgdGhpcyB2YWx1ZS5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIHtudW1iZXJ9XG5cdFx0ICogQGRlZmF1bHQgMTI4XG5cdFx0ICovXG5cdFx0dGhpcy5tYXhWZWxvY2l0eUxlbmd0aCA9IDEyODtcblxuXHRcdC8qKlxuXHRcdCAqIEJhc2VsaW5lIHdlaWdodCBhcHBsaWVkIHRvIHRoZSBjdXJyZW50IGZyYW1lIGluIHRoZSByZXNvbHZlLiBMb3dlclxuXHRcdCAqIHZhbHVlcyBwcm9kdWNlIHNtb290aGVyIHJlc3VsdHMgd2l0aCBsb25nZXIgYWNjdW11bGF0aW9uIGJ1dCBzbG93ZXJcblx0XHQgKiBjb252ZXJnZW5jZSBvbiBkaXNvY2NsdWRlZCByZWdpb25zOyB0aGUgbW90aW9uIGZhY3RvciBpcyBhZGRlZCBvblxuXHRcdCAqIHRvcCwgc28gZmFzdC1tb3ZpbmcgcGl4ZWxzIHN0aWxsIHJlc3BvbmQgcXVpY2tseS5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIHtudW1iZXJ9XG5cdFx0ICogQGRlZmF1bHQgMC4wMjVcblx0XHQgKi9cblx0XHR0aGlzLmN1cnJlbnRGcmFtZVdlaWdodCA9IDAuMDI1O1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGppdHRlciBpbmRleCBzZWxlY3RzIHRoZSBjdXJyZW50IGNhbWVyYSBvZmZzZXQgdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtudW1iZXJ9XG5cdFx0ICogQGRlZmF1bHQgMFxuXHRcdCAqL1xuXHRcdHRoaXMuX2ppdHRlckluZGV4ID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIEEgdW5pZm9ybSBub2RlIGhvbGRpbmcgdGhlIGN1cnJlbnQgaml0dGVyIG9mZnNldCBpbiBpbnB1dC1waXhlbFxuXHRcdCAqIHVuaXRzLiBUaGUgc2hhZGVyIG5lZWRzIHRoaXMgdG8ga25vdyB3aGVyZSBlYWNoIGlucHV0IHNhbXBsZSB3YXNcblx0XHQgKiBhY3R1YWxseSByZW5kZXJlZCB3aGVuIGNvbXB1dGluZyBwZXItdGFwIHJlY29uc3RydWN0aW9uIHdlaWdodHMuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtVbmlmb3JtTm9kZTx2ZWMyPn1cblx0XHQgKi9cblx0XHR0aGlzLl9qaXR0ZXJPZmZzZXQgPSB1bmlmb3JtKCBuZXcgVmVjdG9yMigpICk7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgcmVuZGVyIHRhcmdldCB0aGF0IHJlcHJlc2VudHMgdGhlIGhpc3Rvcnkgb2YgZnJhbWUgZGF0YS5cblx0XHQgKiBTaXplZCB0byB0aGUgcmVuZGVyZXIncyBkcmF3aW5nIGJ1ZmZlciAodGhlIG91dHB1dCByZXNvbHV0aW9uKS5cblx0XHQgKlxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICogQHR5cGUgez9SZW5kZXJUYXJnZXR9XG5cdFx0ICovXG5cdFx0dGhpcy5faGlzdG9yeVJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoIDEsIDEsIHsgZGVwdGhCdWZmZXI6IGZhbHNlLCB0eXBlOiBIYWxmRmxvYXRUeXBlLCBjb3VudDogMiB9ICk7XG5cdFx0dGhpcy5faGlzdG9yeVJlbmRlclRhcmdldC50ZXh0dXJlc1sgMCBdLm5hbWUgPSAnVEFBVU5vZGUuaGlzdG9yeS5jb2xvcic7XG5cdFx0dGhpcy5faGlzdG9yeVJlbmRlclRhcmdldC50ZXh0dXJlc1sgMSBdLm5hbWUgPSAnVEFBVU5vZGUuaGlzdG9yeS5sb2NrJztcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSByZW5kZXIgdGFyZ2V0IGZvciB0aGUgcmVzb2x2ZS4gU2l6ZWQgdG8gdGhlIHJlbmRlcmVyJ3MgZHJhd2luZ1xuXHRcdCAqIGJ1ZmZlciAodGhlIG91dHB1dCByZXNvbHV0aW9uKS5cblx0XHQgKlxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICogQHR5cGUgez9SZW5kZXJUYXJnZXR9XG5cdFx0ICovXG5cdFx0dGhpcy5fcmVzb2x2ZVJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoIDEsIDEsIHsgZGVwdGhCdWZmZXI6IGZhbHNlLCB0eXBlOiBIYWxmRmxvYXRUeXBlIH0gKTtcblx0XHR0aGlzLl9yZXNvbHZlUmVuZGVyVGFyZ2V0LnRleHR1cmUubmFtZSA9ICdUQUFVTm9kZS5yZXNvbHZlJztcblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0YXJnZXQgd2hvc2UgZGVwdGggYXR0YWNobWVudCBob2xkcyB0aGUgcHJldmlvdXMgZnJhbWUnc1xuXHRcdCAqIGRlcHRoIGJ1ZmZlci4gVGhlIGRlcHRoIHRleHR1cmUgbXVzdCBiZSBvd25lZCBieSBhIHJlbmRlciB0YXJnZXRcblx0XHQgKiBzbyB0aGF0IGBjb3B5VGV4dHVyZVRvVGV4dHVyZWAgY2FuIGNvcHkgaW50byBpdCBvbiB0aGUgV2ViR0xcblx0XHQgKiBiYWNrZW5kLCB3aGljaCB1c2VzIGEgZnJhbWVidWZmZXIgYmxpdCBhbmQgdGhlcmVmb3JlIG5lZWRzIHRoZVxuXHRcdCAqIGRlc3RpbmF0aW9uIGRlcHRoIHRleHR1cmUgdG8gYmUgYXR0YWNoZWQgdG8gYSBmcmFtZWJ1ZmZlci4gVGhpc1xuXHRcdCAqIHJlbmRlciB0YXJnZXQgaXMgc2l6ZWQgaW5kZXBlbmRlbnRseSBvZiB0aGUgaGlzdG9yeSB0YXJnZXQgc28gaXRcblx0XHQgKiBjYW4gbWF0Y2ggdGhlIChsb3dlci1yZXNvbHV0aW9uKSBpbnB1dCBkZXB0aCB0ZXh0dXJlLlxuXHRcdCAqXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuXHRcdCAqL1xuXHRcdHRoaXMuX3ByZXZpb3VzRGVwdGhSZW5kZXJUYXJnZXQgPSBuZXcgUmVuZGVyVGFyZ2V0KCAxLCAxLCB7IGRlcHRoQnVmZmVyOiBmYWxzZSwgZGVwdGhUZXh0dXJlOiBuZXcgRGVwdGhUZXh0dXJlKCkgfSApO1xuXHRcdHRoaXMuX3ByZXZpb3VzRGVwdGhSZW5kZXJUYXJnZXQuZGVwdGhUZXh0dXJlLm5hbWUgPSAnVEFBVU5vZGUucHJldmlvdXNEZXB0aCc7XG5cblx0XHQvKipcblx0XHQgKiBNYXRlcmlhbCB1c2VkIGZvciB0aGUgcmVzb2x2ZSBzdGVwLlxuXHRcdCAqXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAdHlwZSB7Tm9kZU1hdGVyaWFsfVxuXHRcdCAqL1xuXHRcdHRoaXMuX3Jlc29sdmVNYXRlcmlhbCA9IG5ldyBOb2RlTWF0ZXJpYWwoKTtcblx0XHR0aGlzLl9yZXNvbHZlTWF0ZXJpYWwubmFtZSA9ICdUQUFVLnJlc29sdmUnO1xuXG5cdFx0LyoqXG5cdFx0ICogTWF0ZXJpYWwgdXNlZCB0byBzZWVkIHRoZSBoaXN0b3J5IHJlbmRlciB0YXJnZXQgb24gcmVzaXplLiBJdFxuXHRcdCAqIHBlcmZvcm1zIGEgYmlsaW5lYXIgdXBzY2FsZSBvZiB0aGUgY3VycmVudCBiZWF1dHkgYnVmZmVyIGludG8gdGhlXG5cdFx0ICogb3V0cHV0LXNpemVkIGhpc3RvcnkgdGFyZ2V0IHNvIHRoYXQgdGhlIGZpcnN0IGZyYW1lcyBhZnRlciBhXG5cdFx0ICogcmVzaXplIGRvIG5vdCBmYWRlIGluIGZyb20gYmxhY2suXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtOb2RlTWF0ZXJpYWx9XG5cdFx0ICovXG5cdFx0dGhpcy5fc2VlZE1hdGVyaWFsID0gbmV3IE5vZGVNYXRlcmlhbCgpO1xuXHRcdHRoaXMuX3NlZWRNYXRlcmlhbC5uYW1lID0gJ1RBQVUuc2VlZCc7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgcmVzdWx0IG9mIHRoZSBlZmZlY3QgaXMgcmVwcmVzZW50ZWQgYXMgYSBzZXBhcmF0ZSB0ZXh0dXJlIG5vZGUuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtQYXNzVGV4dHVyZU5vZGV9XG5cdFx0ICovXG5cdFx0dGhpcy5fdGV4dHVyZU5vZGUgPSBwYXNzVGV4dHVyZSggdGhpcywgdGhpcy5fcmVzb2x2ZVJlbmRlclRhcmdldC50ZXh0dXJlICk7XG5cblx0XHQvKipcblx0XHQgKiBVc2VkIHRvIHNhdmUgdGhlIG9yaWdpbmFsL3Vuaml0dGVyZWQgcHJvamVjdGlvbiBtYXRyaXguXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtNYXRyaXg0fVxuXHRcdCAqL1xuXHRcdHRoaXMuX29yaWdpbmFsUHJvamVjdGlvbk1hdHJpeCA9IG5ldyBNYXRyaXg0KCk7XG5cblx0XHQvKipcblx0XHQgKiBBIHVuaWZvcm0gbm9kZSBob2xkaW5nIHRoZSBjYW1lcmEncyBuZWFyIGFuZCBmYXIuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtVbmlmb3JtTm9kZTx2ZWMyPn1cblx0XHQgKi9cblx0XHR0aGlzLl9jYW1lcmFOZWFyRmFyID0gdW5pZm9ybSggbmV3IFZlY3RvcjIoKSApO1xuXG5cdFx0LyoqXG5cdFx0ICogQSB1bmlmb3JtIG5vZGUgaG9sZGluZyB0aGUgY2FtZXJhIHdvcmxkIG1hdHJpeC5cblx0XHQgKlxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICogQHR5cGUge1VuaWZvcm1Ob2RlPG1hdDQ+fVxuXHRcdCAqL1xuXHRcdHRoaXMuX2NhbWVyYVdvcmxkTWF0cml4ID0gdW5pZm9ybSggbmV3IE1hdHJpeDQoKSApO1xuXG5cdFx0LyoqXG5cdFx0ICogQSB1bmlmb3JtIG5vZGUgaG9sZGluZyB0aGUgY2FtZXJhIHdvcmxkIG1hdHJpeCBpbnZlcnNlLlxuXHRcdCAqXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAdHlwZSB7VW5pZm9ybU5vZGU8bWF0ND59XG5cdFx0ICovXG5cdFx0dGhpcy5fY2FtZXJhV29ybGRNYXRyaXhJbnZlcnNlID0gdW5pZm9ybSggbmV3IE1hdHJpeDQoKSApO1xuXG5cdFx0LyoqXG5cdFx0ICogQSB1bmlmb3JtIG5vZGUgaG9sZGluZyB0aGUgY2FtZXJhIHByb2plY3Rpb24gbWF0cml4IGludmVyc2UuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtVbmlmb3JtTm9kZTxtYXQ0Pn1cblx0XHQgKi9cblx0XHR0aGlzLl9jYW1lcmFQcm9qZWN0aW9uTWF0cml4SW52ZXJzZSA9IHVuaWZvcm0oIG5ldyBNYXRyaXg0KCkgKTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgdW5pZm9ybSBub2RlIGhvbGRpbmcgdGhlIHByZXZpb3VzIGZyYW1lJ3MgdmlldyBtYXRyaXguXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqIEB0eXBlIHtVbmlmb3JtTm9kZTxtYXQ0Pn1cblx0XHQgKi9cblx0XHR0aGlzLl9wcmV2aW91c0NhbWVyYVdvcmxkTWF0cml4ID0gdW5pZm9ybSggbmV3IE1hdHJpeDQoKSApO1xuXG5cdFx0LyoqXG5cdFx0ICogQSB1bmlmb3JtIG5vZGUgaG9sZGluZyB0aGUgcHJldmlvdXMgZnJhbWUncyBwcm9qZWN0aW9uIG1hdHJpeCBpbnZlcnNlLlxuXHRcdCAqXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAdHlwZSB7VW5pZm9ybU5vZGU8bWF0ND59XG5cdFx0ICovXG5cdFx0dGhpcy5fcHJldmlvdXNDYW1lcmFQcm9qZWN0aW9uTWF0cml4SW52ZXJzZSA9IHVuaWZvcm0oIG5ldyBNYXRyaXg0KCkgKTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgdGV4dHVyZSBub2RlIGZvciB0aGUgcHJldmlvdXMgZGVwdGggYnVmZmVyLlxuXHRcdCAqXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAdHlwZSB7VGV4dHVyZU5vZGV9XG5cdFx0ICovXG5cdFx0dGhpcy5fcHJldmlvdXNEZXB0aE5vZGUgPSB0ZXh0dXJlKCB0aGlzLl9wcmV2aW91c0RlcHRoUmVuZGVyVGFyZ2V0LmRlcHRoVGV4dHVyZSApO1xuXG5cdFx0LyoqXG5cdFx0ICogU3luYyB0aGUgcG9zdCBwcm9jZXNzaW5nIHN0YWNrIHdpdGggdGhlIFRBQVUgbm9kZS5cblx0XHQgKlxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICogQHR5cGUge2Jvb2xlYW59XG5cdFx0ICovXG5cdFx0dGhpcy5fbmVlZHNQb3N0UHJvY2Vzc2luZ1N5bmMgPSBmYWxzZTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiB0aGUgZWZmZWN0IGFzIGEgdGV4dHVyZSBub2RlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtQYXNzVGV4dHVyZU5vZGV9IEEgdGV4dHVyZSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgcmVzdWx0IG9mIHRoZSBlZmZlY3QuXG5cdCAqL1xuXHRnZXRUZXh0dXJlTm9kZSgpIHtcblxuXHRcdHJldHVybiB0aGlzLl90ZXh0dXJlTm9kZTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIG91dHB1dCBzaXplIG9mIHRoZSBlZmZlY3QgKGhpc3RvcnkgYW5kIHJlc29sdmUgdGFyZ2V0cykuIFRoZVxuXHQgKiBwcmV2aW91cy1kZXB0aCB0ZXh0dXJlIGlzIHNpemVkIGluZGVwZW5kZW50bHkgaW4gYHVwZGF0ZUJlZm9yZSgpYCB0b1xuXHQgKiB0cmFjayB0aGUgc2NlbmUncyBjdXJyZW50IGRlcHRoIHRleHR1cmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBvdXRwdXRXaWR0aCAtIFRoZSBvdXRwdXQgd2lkdGggKGRyYXdpbmcgYnVmZmVyIHdpZHRoKS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG91dHB1dEhlaWdodCAtIFRoZSBvdXRwdXQgaGVpZ2h0IChkcmF3aW5nIGJ1ZmZlciBoZWlnaHQpLlxuXHQgKi9cblx0c2V0U2l6ZSggb3V0cHV0V2lkdGgsIG91dHB1dEhlaWdodCApIHtcblxuXHRcdHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQuc2V0U2l6ZSggb3V0cHV0V2lkdGgsIG91dHB1dEhlaWdodCApO1xuXHRcdHRoaXMuX3Jlc29sdmVSZW5kZXJUYXJnZXQuc2V0U2l6ZSggb3V0cHV0V2lkdGgsIG91dHB1dEhlaWdodCApO1xuXG5cdH1cblxuXHQvKipcblx0ICogRGVmaW5lcyB0aGUgVEFBVSdzIGN1cnJlbnQgaml0dGVyIGFzIGEgdmlldyBvZmZzZXQgdG8gdGhlIHNjZW5lJ3Ncblx0ICogY2FtZXJhLiBUaGUgaml0dGVyIGlzIHNocnVuayB0byBvbmUgKm91dHB1dCogcGl4ZWwgKHJhdGhlciB0aGFuIG9uZVxuXHQgKiBpbnB1dCBwaXhlbCkgc28gdGhhdCB0aGUgaGFsdG9uIHNlcXVlbmNlIGdyYWR1YWxseSBmaWxscyB0aGUgb3V0cHV0XG5cdCAqIHN1Yi1waXhlbCBncmlkIG92ZXIgbXVsdGlwbGUgZnJhbWVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gaW5wdXRXaWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgaW5wdXQgYnVmZmVycyB0aGUgY2FtZXJhIHJlbmRlcnMgaW50by5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGlucHV0SGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgaW5wdXQgYnVmZmVycyB0aGUgY2FtZXJhIHJlbmRlcnMgaW50by5cblx0ICovXG5cdHNldFZpZXdPZmZzZXQoIGlucHV0V2lkdGgsIGlucHV0SGVpZ2h0ICkge1xuXG5cdFx0Ly8gc2F2ZSBvcmlnaW5hbC91bmppdHRlcmVkIHByb2plY3Rpb24gbWF0cml4IGZvciB2ZWxvY2l0eSBwYXNzXG5cblx0XHR0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdFx0dGhpcy5fb3JpZ2luYWxQcm9qZWN0aW9uTWF0cml4LmNvcHkoIHRoaXMuY2FtZXJhLnByb2plY3Rpb25NYXRyaXggKTtcblxuXHRcdHZlbG9jaXR5LnNldFByb2plY3Rpb25NYXRyaXgoIHRoaXMuX29yaWdpbmFsUHJvamVjdGlvbk1hdHJpeCApO1xuXG5cdFx0Ly8gVGhlIGppdHRlciByYW5nZSBtdXN0IHNwYW4gb25lIG91dHB1dCBwaXhlbCAobm90IG9uZSBpbnB1dCBwaXhlbCksXG5cdFx0Ly8gc28gd2Ugc2hyaW5rIHRoZSBpbnB1dC1waXhlbC11bml0IG9mZnNldCBieSB0aGUgcmF0aW8gb2YgaW5wdXQgdG9cblx0XHQvLyBvdXRwdXQgcmVzb2x1dGlvbi5cblxuXHRcdGNvbnN0IGhhbHRvbk9mZnNldCA9IF9oYWx0b25PZmZzZXRzWyB0aGlzLl9qaXR0ZXJJbmRleCBdO1xuXHRcdGNvbnN0IGppdHRlclggPSAoIGhhbHRvbk9mZnNldFsgMCBdIC0gMC41ICk7XG5cdFx0Y29uc3Qgaml0dGVyWSA9ICggaGFsdG9uT2Zmc2V0WyAxIF0gLSAwLjUgKTtcblxuXHRcdHRoaXMuX2ppdHRlck9mZnNldC52YWx1ZS5zZXQoIGppdHRlclgsIGppdHRlclkgKTtcblxuXHRcdHRoaXMuY2FtZXJhLnNldFZpZXdPZmZzZXQoXG5cblx0XHRcdGlucHV0V2lkdGgsIGlucHV0SGVpZ2h0LFxuXG5cdFx0XHRqaXR0ZXJYLCBqaXR0ZXJZLFxuXG5cdFx0XHRpbnB1dFdpZHRoLCBpbnB1dEhlaWdodFxuXG5cdFx0KTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIENsZWFycyB0aGUgdmlldyBvZmZzZXQgZnJvbSB0aGUgc2NlbmUncyBjYW1lcmEuXG5cdCAqL1xuXHRjbGVhclZpZXdPZmZzZXQoKSB7XG5cblx0XHR0aGlzLmNhbWVyYS5jbGVhclZpZXdPZmZzZXQoKTtcblxuXHRcdHZlbG9jaXR5LnNldFByb2plY3Rpb25NYXRyaXgoIG51bGwgKTtcblxuXHRcdC8vIHVwZGF0ZSBqaXR0ZXIgaW5kZXhcblxuXHRcdHRoaXMuX2ppdHRlckluZGV4ICsrO1xuXHRcdHRoaXMuX2ppdHRlckluZGV4ID0gdGhpcy5faml0dGVySW5kZXggJSAoIF9oYWx0b25PZmZzZXRzLmxlbmd0aCAtIDEgKTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIFRoaXMgbWV0aG9kIGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBlZmZlY3Qgb25jZSBwZXIgZnJhbWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Tm9kZUZyYW1lfSBmcmFtZSAtIFRoZSBjdXJyZW50IG5vZGUgZnJhbWUuXG5cdCAqL1xuXHR1cGRhdGVCZWZvcmUoIGZyYW1lICkge1xuXG5cdFx0Y29uc3QgeyByZW5kZXJlciB9ID0gZnJhbWU7XG5cblx0XHQvLyBzdG9yZSBwcmV2aW91cyBmcmFtZSBtYXRyaWNlcyBiZWZvcmUgdXBkYXRpbmcgY3VycmVudCBvbmVzXG5cblx0XHR0aGlzLl9wcmV2aW91c0NhbWVyYVdvcmxkTWF0cml4LnZhbHVlLmNvcHkoIHRoaXMuX2NhbWVyYVdvcmxkTWF0cml4LnZhbHVlICk7XG5cdFx0dGhpcy5fcHJldmlvdXNDYW1lcmFQcm9qZWN0aW9uTWF0cml4SW52ZXJzZS52YWx1ZS5jb3B5KCB0aGlzLl9jYW1lcmFQcm9qZWN0aW9uTWF0cml4SW52ZXJzZS52YWx1ZSApO1xuXG5cdFx0Ly8gdXBkYXRlIGNhbWVyYSBtYXRyaWNlcyB1bmlmb3Jtc1xuXG5cdFx0dGhpcy5fY2FtZXJhTmVhckZhci52YWx1ZS5zZXQoIHRoaXMuY2FtZXJhLm5lYXIsIHRoaXMuY2FtZXJhLmZhciApO1xuXHRcdHRoaXMuX2NhbWVyYVdvcmxkTWF0cml4LnZhbHVlLmNvcHkoIHRoaXMuY2FtZXJhLm1hdHJpeFdvcmxkICk7XG5cdFx0dGhpcy5fY2FtZXJhV29ybGRNYXRyaXhJbnZlcnNlLnZhbHVlLmNvcHkoIHRoaXMuY2FtZXJhLm1hdHJpeFdvcmxkSW52ZXJzZSApO1xuXHRcdHRoaXMuX2NhbWVyYVByb2plY3Rpb25NYXRyaXhJbnZlcnNlLnZhbHVlLmNvcHkoIHRoaXMuY2FtZXJhLnByb2plY3Rpb25NYXRyaXhJbnZlcnNlICk7XG5cblx0XHQvLyBleHRyYWN0IGlucHV0IGRpbWVuc2lvbnMgZnJvbSB0aGUgYmVhdXR5IGJ1ZmZlciBhbmQgb3V0cHV0XG5cdFx0Ly8gZGltZW5zaW9ucyBmcm9tIHRoZSByZW5kZXJlcidzIGRyYXdpbmcgYnVmZmVyXG5cblx0XHRjb25zdCBiZWF1dHlSZW5kZXJUYXJnZXQgPSAoIHRoaXMuYmVhdXR5Tm9kZS5pc1JUVE5vZGUgKSA/IHRoaXMuYmVhdXR5Tm9kZS5yZW5kZXJUYXJnZXQgOiB0aGlzLmJlYXV0eU5vZGUucGFzc05vZGUucmVuZGVyVGFyZ2V0O1xuXG5cdFx0Y29uc3QgaW5wdXRXaWR0aCA9IGJlYXV0eVJlbmRlclRhcmdldC50ZXh0dXJlLndpZHRoO1xuXHRcdGNvbnN0IGlucHV0SGVpZ2h0ID0gYmVhdXR5UmVuZGVyVGFyZ2V0LnRleHR1cmUuaGVpZ2h0O1xuXG5cdFx0Y29uc3QgZHJhd2luZ0J1ZmZlclNpemUgPSByZW5kZXJlci5nZXREcmF3aW5nQnVmZmVyU2l6ZSggX3NpemUgKTtcblx0XHRjb25zdCBvdXRwdXRXaWR0aCA9IGRyYXdpbmdCdWZmZXJTaXplLndpZHRoO1xuXHRcdGNvbnN0IG91dHB1dEhlaWdodCA9IGRyYXdpbmdCdWZmZXJTaXplLmhlaWdodDtcblxuXHRcdC8vXG5cblx0XHRfcmVuZGVyZXJTdGF0ZSA9IFJlbmRlcmVyVXRpbHMucmVzZXRSZW5kZXJlclN0YXRlKCByZW5kZXJlciwgX3JlbmRlcmVyU3RhdGUgKTtcblxuXHRcdC8vXG5cblx0XHRjb25zdCBuZWVkc1Jlc3RhcnQgPVxuXHRcdFx0dGhpcy5faGlzdG9yeVJlbmRlclRhcmdldC53aWR0aCAhPT0gb3V0cHV0V2lkdGggfHxcblx0XHRcdHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQuaGVpZ2h0ICE9PSBvdXRwdXRIZWlnaHQ7XG5cblx0XHR0aGlzLnNldFNpemUoIG91dHB1dFdpZHRoLCBvdXRwdXRIZWlnaHQgKTtcblxuXHRcdC8vIGV2ZXJ5IHRpbWUgdGhlIGRpbWVuc2lvbnMgY2hhbmdlIHdlIG5lZWQgZnJlc2ggaGlzdG9yeSBkYXRhXG5cblx0XHRpZiAoIG5lZWRzUmVzdGFydCA9PT0gdHJ1ZSApIHtcblxuXHRcdFx0Ly8gbWFrZSBzdXJlIHJlbmRlciB0YXJnZXRzIGFyZSBpbml0aWFsaXplZCBhZnRlciB0aGUgcmVzaXplIHdoaWNoIHRyaWdnZXJzIGEgZGlzcG9zZSgpXG5cblx0XHRcdHJlbmRlcmVyLmluaXRSZW5kZXJUYXJnZXQoIHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQgKTtcblx0XHRcdHJlbmRlcmVyLmluaXRSZW5kZXJUYXJnZXQoIHRoaXMuX3Jlc29sdmVSZW5kZXJUYXJnZXQgKTtcblxuXHRcdFx0Ly8gU2VlZCB0aGUgaGlzdG9yeSB3aXRoIGEgYmlsaW5lYXIgdXBzY2FsZSBvZiB0aGUgY3VycmVudCBiZWF1dHlcblx0XHRcdC8vIGJ1ZmZlci4gV2l0aG91dCB0aGlzIHRoZSBmaXJzdCBmcmFtZXMgYWZ0ZXIgYSByZXNpemUgZmFkZSBpblxuXHRcdFx0Ly8gZnJvbSBibGFjayBiZWNhdXNlIHRoZSBoaXN0b3J5IHRhcmdldCB3YXMgY2xlYXJlZC4gVGhlIHNlZWRcblx0XHRcdC8vIG1hdGVyaWFsIGlzIGEgcXVhZCBwYXNzIHRoYXQgc2FtcGxlcyBiZWF1dHkgYXQgb3V0cHV0IFVWcywgc29cblx0XHRcdC8vIGl0IHByb2R1Y2VzIGFuIG91dHB1dC1zaXplZCBpbWFnZSByZWdhcmRsZXNzIG9mIHRoZSBpbnB1dCBzaXplLlxuXG5cdFx0XHRyZW5kZXJlci5zZXRSZW5kZXJUYXJnZXQoIHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQgKTtcblx0XHRcdF9xdWFkTWVzaC5tYXRlcmlhbCA9IHRoaXMuX3NlZWRNYXRlcmlhbDtcblx0XHRcdF9xdWFkTWVzaC5uYW1lID0gJ1RBQVUuc2VlZCc7XG5cdFx0XHRfcXVhZE1lc2gucmVuZGVyKCByZW5kZXJlciApO1xuXHRcdFx0cmVuZGVyZXIuc2V0UmVuZGVyVGFyZ2V0KCBudWxsICk7XG5cblx0XHR9XG5cblx0XHQvLyBtdXN0IHJ1biBhZnRlciBuZWVkc1Jlc3RhcnQgc28gaXQgZG9lcyBub3QgYWZmZWN0IHRoZSBzZWVkIHJlc2V0XG5cblx0XHRpZiAoIHRoaXMuX25lZWRzUG9zdFByb2Nlc3NpbmdTeW5jID09PSB0cnVlICkge1xuXG5cdFx0XHR0aGlzLnNldFZpZXdPZmZzZXQoIGlucHV0V2lkdGgsIGlucHV0SGVpZ2h0ICk7XG5cblx0XHRcdHRoaXMuX25lZWRzUG9zdFByb2Nlc3NpbmdTeW5jID0gZmFsc2U7XG5cblx0XHR9XG5cblx0XHQvLyByZXNvbHZlXG5cblx0XHRyZW5kZXJlci5zZXRSZW5kZXJUYXJnZXQoIHRoaXMuX3Jlc29sdmVSZW5kZXJUYXJnZXQgKTtcblx0XHRfcXVhZE1lc2gubWF0ZXJpYWwgPSB0aGlzLl9yZXNvbHZlTWF0ZXJpYWw7XG5cdFx0X3F1YWRNZXNoLm5hbWUgPSAnVEFBVSc7XG5cdFx0X3F1YWRNZXNoLnJlbmRlciggcmVuZGVyZXIgKTtcblx0XHRyZW5kZXJlci5zZXRSZW5kZXJUYXJnZXQoIG51bGwgKTtcblxuXHRcdC8vIHVwZGF0ZSBoaXN0b3J5XG5cblx0XHRyZW5kZXJlci5jb3B5VGV4dHVyZVRvVGV4dHVyZSggdGhpcy5fcmVzb2x2ZVJlbmRlclRhcmdldC50ZXh0dXJlLCB0aGlzLl9oaXN0b3J5UmVuZGVyVGFyZ2V0LnRleHR1cmUgKTtcblxuXHRcdC8vIENvcHkgdGhlIGN1cnJlbnQgc2NlbmUgZGVwdGggaW50byB0aGUgcHJldmlvdXMtZGVwdGggdGV4dHVyZS4gV2Vcblx0XHQvLyBrZWVwIHRoZSBkZXN0aW5hdGlvbiBzaXplIGxvY2tlZCB0byB0aGUgc291cmNlJ3MgYWN0dWFsIGRpbWVuc2lvbnNcblx0XHQvLyBzbyB0aGF0IGFueSBvbmUtZnJhbWUgdGltaW5nIG1pc21hdGNoIGJldHdlZW4gdGhlIHNjZW5lIHBhc3MncyBkZXB0aFxuXHRcdC8vIGF0dGFjaG1lbnQgYW5kIHRoZSBiZWF1dHkgcmVuZGVyIHRhcmdldCdzIGJvb2trZWVwaW5nIGNhbm5vdFxuXHRcdC8vIHByb2R1Y2UgYSBjb3B5IHdpdGggbWlzbWF0Y2hlZCBleHRlbnRzICh3aGljaCBXZWJHUFUgcmVqZWN0cyBmb3Jcblx0XHQvLyBkZXB0aC9zdGVuY2lsIGZvcm1hdHMpLlxuXG5cdFx0Y29uc3QgY3VycmVudERlcHRoID0gdGhpcy5kZXB0aE5vZGUudmFsdWU7XG5cdFx0Y29uc3Qgc3JjVyA9IGN1cnJlbnREZXB0aC5pbWFnZSAhPT0gbnVsbCAmJiBjdXJyZW50RGVwdGguaW1hZ2UgIT09IHVuZGVmaW5lZCA/IGN1cnJlbnREZXB0aC5pbWFnZS53aWR0aCA6IDA7XG5cdFx0Y29uc3Qgc3JjSCA9IGN1cnJlbnREZXB0aC5pbWFnZSAhPT0gbnVsbCAmJiBjdXJyZW50RGVwdGguaW1hZ2UgIT09IHVuZGVmaW5lZCA/IGN1cnJlbnREZXB0aC5pbWFnZS5oZWlnaHQgOiAwO1xuXG5cdFx0aWYgKCBzcmNXID4gMCAmJiBzcmNIID4gMCApIHtcblxuXHRcdFx0aWYgKCB0aGlzLl9wcmV2aW91c0RlcHRoUmVuZGVyVGFyZ2V0LndpZHRoICE9PSBzcmNXIHx8IHRoaXMuX3ByZXZpb3VzRGVwdGhSZW5kZXJUYXJnZXQuaGVpZ2h0ICE9PSBzcmNIICkge1xuXG5cdFx0XHRcdHRoaXMuX3ByZXZpb3VzRGVwdGhSZW5kZXJUYXJnZXQuc2V0U2l6ZSggc3JjVywgc3JjSCApO1xuXHRcdFx0XHRyZW5kZXJlci5pbml0UmVuZGVyVGFyZ2V0KCB0aGlzLl9wcmV2aW91c0RlcHRoUmVuZGVyVGFyZ2V0ICk7XG5cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZHN0RGVwdGggPSB0aGlzLl9wcmV2aW91c0RlcHRoUmVuZGVyVGFyZ2V0LmRlcHRoVGV4dHVyZTtcblx0XHRcdHJlbmRlcmVyLmNvcHlUZXh0dXJlVG9UZXh0dXJlKCBjdXJyZW50RGVwdGgsIGRzdERlcHRoICk7XG5cdFx0XHR0aGlzLl9wcmV2aW91c0RlcHRoTm9kZS52YWx1ZSA9IGRzdERlcHRoO1xuXG5cdFx0fVxuXG5cdFx0Ly8gcmVzdG9yZVxuXG5cdFx0UmVuZGVyZXJVdGlscy5yZXN0b3JlUmVuZGVyZXJTdGF0ZSggcmVuZGVyZXIsIF9yZW5kZXJlclN0YXRlICk7XG5cblx0fVxuXG5cdC8qKlxuXHQgKiBUaGlzIG1ldGhvZCBpcyB1c2VkIHRvIHNldHVwIHRoZSBlZmZlY3QncyByZW5kZXIgdGFyZ2V0cyBhbmQgVFNMIGNvZGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Tm9kZUJ1aWxkZXJ9IGJ1aWxkZXIgLSBUaGUgY3VycmVudCBub2RlIGJ1aWxkZXIuXG5cdCAqIEByZXR1cm4ge1Bhc3NUZXh0dXJlTm9kZX1cblx0ICovXG5cdHNldHVwKCBidWlsZGVyICkge1xuXG5cdFx0Y29uc3QgcmVuZGVyUGlwZWxpbmUgPSBidWlsZGVyLmNvbnRleHQucmVuZGVyUGlwZWxpbmU7XG5cblx0XHRpZiAoIHJlbmRlclBpcGVsaW5lICkge1xuXG5cdFx0XHR0aGlzLl9uZWVkc1Bvc3RQcm9jZXNzaW5nU3luYyA9IHRydWU7XG5cblx0XHRcdHJlbmRlclBpcGVsaW5lLmNvbnRleHQub25CZWZvcmVSZW5kZXJQaXBlbGluZSA9ICgpID0+IHtcblxuXHRcdFx0XHRjb25zdCBiZWF1dHlSZW5kZXJUYXJnZXQgPSAoIHRoaXMuYmVhdXR5Tm9kZS5pc1JUVE5vZGUgKSA/IHRoaXMuYmVhdXR5Tm9kZS5yZW5kZXJUYXJnZXQgOiB0aGlzLmJlYXV0eU5vZGUucGFzc05vZGUucmVuZGVyVGFyZ2V0O1xuXG5cdFx0XHRcdGNvbnN0IGlucHV0V2lkdGggPSBiZWF1dHlSZW5kZXJUYXJnZXQudGV4dHVyZS53aWR0aDtcblx0XHRcdFx0Y29uc3QgaW5wdXRIZWlnaHQgPSBiZWF1dHlSZW5kZXJUYXJnZXQudGV4dHVyZS5oZWlnaHQ7XG5cblx0XHRcdFx0dGhpcy5zZXRWaWV3T2Zmc2V0KCBpbnB1dFdpZHRoLCBpbnB1dEhlaWdodCApO1xuXG5cdFx0XHR9O1xuXG5cdFx0XHRyZW5kZXJQaXBlbGluZS5jb250ZXh0Lm9uQWZ0ZXJSZW5kZXJQaXBlbGluZSA9ICgpID0+IHtcblxuXHRcdFx0XHR0aGlzLmNsZWFyVmlld09mZnNldCgpO1xuXG5cdFx0XHR9O1xuXG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudERlcHRoU3RydWN0ID0gc3RydWN0KCB7XG5cblx0XHRcdGNsb3Nlc3REZXB0aDogJ2Zsb2F0Jyxcblx0XHRcdGNsb3Nlc3RQb3NpdGlvblRleGVsOiAndmVjMicsXG5cdFx0XHRmYXJ0aGVzdERlcHRoOiAnZmxvYXQnLFxuXG5cdFx0fSApO1xuXG5cdFx0Ly8gU2FtcGxlcyAzw5czIG5laWdoYm9yaG9vZCBwaXhlbHMgYW5kIHJldHVybnMgdGhlIGNsb3Nlc3QgYW5kIGZhcnRoZXN0IGRlcHRocy5cblx0XHRjb25zdCBzYW1wbGVDdXJyZW50RGVwdGggPSBGbiggKCBbIHBvc2l0aW9uVGV4ZWwgXSApID0+IHtcblxuXHRcdFx0Y29uc3QgY2xvc2VzdERlcHRoID0gZmxvYXQoIDIgKS50b1ZhcigpO1xuXHRcdFx0Y29uc3QgY2xvc2VzdFBvc2l0aW9uVGV4ZWwgPSB2ZWMyKCAwICkudG9WYXIoKTtcblx0XHRcdGNvbnN0IGZhcnRoZXN0RGVwdGggPSBmbG9hdCggLSAxICkudG9WYXIoKTtcblxuXHRcdFx0Zm9yICggbGV0IHggPSAtIDE7IHggPD0gMTsgKysgeCApIHtcblxuXHRcdFx0XHRmb3IgKCBsZXQgeSA9IC0gMTsgeSA8PSAxOyArKyB5ICkge1xuXG5cdFx0XHRcdFx0Y29uc3QgbmVpZ2hib3IgPSBwb3NpdGlvblRleGVsLmFkZCggdmVjMiggeCwgeSApICkudG9WYXIoKTtcblx0XHRcdFx0XHRjb25zdCBkZXB0aCA9IHRoaXMuZGVwdGhOb2RlLmxvYWQoIG5laWdoYm9yICkuci50b1ZhcigpO1xuXG5cdFx0XHRcdFx0SWYoIGRlcHRoLmxlc3NUaGFuKCBjbG9zZXN0RGVwdGggKSwgKCkgPT4ge1xuXG5cdFx0XHRcdFx0XHRjbG9zZXN0RGVwdGguYXNzaWduKCBkZXB0aCApO1xuXHRcdFx0XHRcdFx0Y2xvc2VzdFBvc2l0aW9uVGV4ZWwuYXNzaWduKCBuZWlnaGJvciApO1xuXG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0SWYoIGRlcHRoLmdyZWF0ZXJUaGFuKCBmYXJ0aGVzdERlcHRoICksICgpID0+IHtcblxuXHRcdFx0XHRcdFx0ZmFydGhlc3REZXB0aC5hc3NpZ24oIGRlcHRoICk7XG5cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjdXJyZW50RGVwdGhTdHJ1Y3QoIGNsb3Nlc3REZXB0aCwgY2xvc2VzdFBvc2l0aW9uVGV4ZWwsIGZhcnRoZXN0RGVwdGggKTtcblxuXHRcdH0gKTtcblxuXHRcdC8vIFNhbXBsZXMgYSBwcmV2aW91cyBkZXB0aCBhbmQgcmVwcm9qZWN0IGl0IHVzaW5nIHRoZSBjdXJyZW50IGNhbWVyYSBtYXRyaWNlcy5cblx0XHRjb25zdCBzYW1wbGVQcmV2aW91c0RlcHRoID0gKCB1diApID0+IHtcblxuXHRcdFx0Y29uc3QgZGVwdGggPSB0aGlzLl9wcmV2aW91c0RlcHRoTm9kZS5zYW1wbGUoIHV2ICkucjtcblx0XHRcdGNvbnN0IHBvc2l0aW9uVmlldyA9IGdldFZpZXdQb3NpdGlvbiggdXYsIGRlcHRoLCB0aGlzLl9wcmV2aW91c0NhbWVyYVByb2plY3Rpb25NYXRyaXhJbnZlcnNlICk7XG5cdFx0XHRjb25zdCBwb3NpdGlvbldvcmxkID0gdGhpcy5fcHJldmlvdXNDYW1lcmFXb3JsZE1hdHJpeC5tdWwoIHZlYzQoIHBvc2l0aW9uVmlldywgMSApICkueHl6O1xuXHRcdFx0Y29uc3Qgdmlld1ogPSB0aGlzLl9jYW1lcmFXb3JsZE1hdHJpeEludmVyc2UubXVsKCB2ZWM0KCBwb3NpdGlvbldvcmxkLCAxICkgKS56O1xuXHRcdFx0cmV0dXJuIHZpZXdaVG9QZXJzcGVjdGl2ZURlcHRoKCB2aWV3WiwgdGhpcy5fY2FtZXJhTmVhckZhci54LCB0aGlzLl9jYW1lcmFOZWFyRmFyLnkgKTtcblxuXHRcdH07XG5cblx0XHQvLyBPcHRpbWl6ZWQgdmVyc2lvbiBvZiBBQUJCIGNsaXBwaW5nLlxuXHRcdC8vIFJlZmVyZW5jZTogaHR0cHM6Ly9naXRodWIuY29tL3BsYXlkZWFkZ2FtZXMvdGVtcG9yYWxcblx0XHRjb25zdCBjbGlwQUFCQiA9IEZuKCAoIFsgY3VycmVudENvbG9yLCBoaXN0b3J5Q29sb3IsIG1pbkNvbG9yLCBtYXhDb2xvciBdICkgPT4ge1xuXG5cdFx0XHRjb25zdCBwQ2xpcCA9IG1heENvbG9yLnJnYi5hZGQoIG1pbkNvbG9yLnJnYiApLm11bCggMC41ICk7XG5cdFx0XHRjb25zdCBlQ2xpcCA9IG1heENvbG9yLnJnYi5zdWIoIG1pbkNvbG9yLnJnYiApLm11bCggMC41ICkuYWRkKCAxZS03ICk7XG5cdFx0XHRjb25zdCB2Q2xpcCA9IGhpc3RvcnlDb2xvci5zdWIoIHZlYzQoIHBDbGlwLCBjdXJyZW50Q29sb3IuYSApICk7XG5cdFx0XHRjb25zdCB2VW5pdCA9IHZDbGlwLnh5ei5kaXYoIGVDbGlwICk7XG5cdFx0XHRjb25zdCBhYnNVbml0ID0gdlVuaXQuYWJzKCk7XG5cdFx0XHRjb25zdCBtYXhVbml0ID0gbWF4KCBhYnNVbml0LngsIGFic1VuaXQueSwgYWJzVW5pdC56ICk7XG5cdFx0XHRyZXR1cm4gbWF4VW5pdC5ncmVhdGVyVGhhbiggMSApLnNlbGVjdChcblx0XHRcdFx0dmVjNCggcENsaXAsIGN1cnJlbnRDb2xvci5hICkuYWRkKCB2Q2xpcC5kaXYoIG1heFVuaXQgKSApLFxuXHRcdFx0XHRoaXN0b3J5Q29sb3Jcblx0XHRcdCk7XG5cblx0XHR9ICkuc2V0TGF5b3V0KCB7XG5cdFx0XHRuYW1lOiAnY2xpcEFBQkInLFxuXHRcdFx0dHlwZTogJ3ZlYzQnLFxuXHRcdFx0aW5wdXRzOiBbXG5cdFx0XHRcdHsgbmFtZTogJ2N1cnJlbnRDb2xvcicsIHR5cGU6ICd2ZWM0JyB9LFxuXHRcdFx0XHR7IG5hbWU6ICdoaXN0b3J5Q29sb3InLCB0eXBlOiAndmVjNCcgfSxcblx0XHRcdFx0eyBuYW1lOiAnbWluQ29sb3InLCB0eXBlOiAndmVjNCcgfSxcblx0XHRcdFx0eyBuYW1lOiAnbWF4Q29sb3InLCB0eXBlOiAndmVjNCcgfVxuXHRcdFx0XVxuXHRcdH0gKTtcblxuXHRcdC8vIEZsaWNrZXIgcmVkdWN0aW9uIGJhc2VkIG9uIGx1bWluYW5jZSB3ZWlnaGluZy5cblx0XHRjb25zdCBmbGlja2VyUmVkdWN0aW9uID0gRm4oICggWyBjdXJyZW50Q29sb3IsIGhpc3RvcnlDb2xvciwgY3VycmVudFdlaWdodCBdICkgPT4ge1xuXG5cdFx0XHRjb25zdCBoaXN0b3J5V2VpZ2h0ID0gY3VycmVudFdlaWdodC5vbmVNaW51cygpO1xuXHRcdFx0Y29uc3QgY29tcHJlc3NlZEN1cnJlbnQgPSBjdXJyZW50Q29sb3IubXVsKCBmbG9hdCggMSApLmRpdiggKCBtYXgoIGN1cnJlbnRDb2xvci5yLCBjdXJyZW50Q29sb3IuZywgY3VycmVudENvbG9yLmIgKS5hZGQoIDEgKSApICkgKTtcblx0XHRcdGNvbnN0IGNvbXByZXNzZWRIaXN0b3J5ID0gaGlzdG9yeUNvbG9yLm11bCggZmxvYXQoIDEgKS5kaXYoICggbWF4KCBoaXN0b3J5Q29sb3IuciwgaGlzdG9yeUNvbG9yLmcsIGhpc3RvcnlDb2xvci5iICkuYWRkKCAxICkgKSApICk7XG5cblx0XHRcdGNvbnN0IGx1bWluYW5jZUN1cnJlbnQgPSBsdW1pbmFuY2UoIGNvbXByZXNzZWRDdXJyZW50LnJnYiApO1xuXHRcdFx0Y29uc3QgbHVtaW5hbmNlSGlzdG9yeSA9IGx1bWluYW5jZSggY29tcHJlc3NlZEhpc3RvcnkucmdiICk7XG5cblx0XHRcdGN1cnJlbnRXZWlnaHQubXVsQXNzaWduKCBmbG9hdCggMSApLmRpdiggbHVtaW5hbmNlQ3VycmVudC5hZGQoIDEgKSApICk7XG5cdFx0XHRoaXN0b3J5V2VpZ2h0Lm11bEFzc2lnbiggZmxvYXQoIDEgKS5kaXYoIGx1bWluYW5jZUhpc3RvcnkuYWRkKCAxICkgKSApO1xuXG5cdFx0XHRyZXR1cm4gYWRkKCBjdXJyZW50Q29sb3IubXVsKCBjdXJyZW50V2VpZ2h0ICksIGhpc3RvcnlDb2xvci5tdWwoIGhpc3RvcnlXZWlnaHQgKSApLmRpdiggbWF4KCBjdXJyZW50V2VpZ2h0LmFkZCggaGlzdG9yeVdlaWdodCApLCAwLjAwMDAxICkgKS50b1ZhcigpO1xuXG5cdFx0fSApO1xuXG5cdFx0Y29uc3QgaGlzdG9yeU5vZGUgPSB0ZXh0dXJlKCB0aGlzLl9oaXN0b3J5UmVuZGVyVGFyZ2V0LnRleHR1cmVzWyAwIF0gKTtcblx0XHRjb25zdCBsb2NrTm9kZSA9IHRleHR1cmUoIHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQudGV4dHVyZXNbIDEgXSApO1xuXG5cdFx0Ly8gLS0tIFRBQVUgcmVzb2x2ZSAtLS1cblx0XHQvL1xuXHRcdC8vIEZvciBlYWNoIG91dHB1dCBwaXhlbCwgd2UgbWFwIGl0cyBwb3NpdGlvbiBpbnRvIGlucHV0LXBpeGVsIHNwYWNlLFxuXHRcdC8vIGZpbmQgdGhlIGNsb3Nlc3Qgaml0dGVyZWQgaW5wdXQgc2FtcGxlLCBhbmQgcmVjb25zdHJ1Y3QgdGhlIGN1cnJlbnRcblx0XHQvLyBjb2xvciBhcyBhIHdlaWdodGVkIHN1bSBvZiB0aGUgM8OXMyBuZWlnaGJvcmhvb2QgYXJvdW5kIHRoYXQgc2FtcGxlLlxuXHRcdC8vIEVhY2ggdGFwJ3Mgd2VpZ2h0IGlzIGEgR2F1c3NpYW4gYXBwcm94aW1hdGlvbiBvZiBhIEJsYWNrbWFuLUhhcnJpc1xuXHRcdC8vIHdpbmRvdyBldmFsdWF0ZWQgYXQgdGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIHRhcCdzIChqaXR0ZXJlZClcblx0XHQvLyBzYW1wbGUgY2VudGVyIGFuZCB0aGUgb3V0cHV0IHBpeGVsIGNlbnRlci4gVGhlIHNhbWUgbmVpZ2hib3Job29kXG5cdFx0Ly8gYWxzbyBzdXBwbGllcyB0aGUgbW9tZW50cyB1c2VkIGZvciB2YXJpYW5jZSBjbGlwcGluZyBvZiB0aGVcblx0XHQvLyByZXByb2plY3RlZCBoaXN0b3J5LCBzbyBubyBzZWNvbmQgbmVpZ2hib3Job29kIHJlYWQgaXMgbmVlZGVkLlxuXG5cdFx0Y29uc3QgY29sb3JPdXRwdXQgPSBwcm9wZXJ0eSggJ3ZlYzQnICk7XG5cdFx0Y29uc3QgbG9ja091dHB1dCA9IHByb3BlcnR5KCAndmVjNCcgKTtcblxuXHRcdGNvbnN0IG91dHB1dE5vZGUgPSBvdXRwdXRTdHJ1Y3QoIGNvbG9yT3V0cHV0LCBsb2NrT3V0cHV0ICk7XG5cblx0XHRjb25zdCByZXNvbHZlID0gRm4oICgpID0+IHtcblxuXHRcdFx0Y29uc3QgdXZOb2RlID0gdXYoKTtcblx0XHRcdGNvbnN0IGlucHV0U2l6ZSA9IHRoaXMuYmVhdXR5Tm9kZS5zaXplKCk7IC8vIGl2ZWMyXG5cdFx0XHRjb25zdCBpbnB1dFNpemVGID0gdmVjMiggaW5wdXRTaXplICk7XG5cblx0XHRcdC8vIG91dHB1dCBwaXhlbCBjZW50ZXIgaW4gaW5wdXQtcGl4ZWwgY29vcmRpbmF0ZXNcblxuXHRcdFx0Y29uc3QgcEluID0gdXZOb2RlLm11bCggaW5wdXRTaXplRiApO1xuXG5cdFx0XHQvLyB0aGUgaW5wdXQgc2FtcGxlIGF0IGludGVnZXIgdGV4ZWwgKG0sIG4pIHdhcyByZW5kZXJlZCBhdCB3b3JsZFxuXHRcdFx0Ly8gcG9zaXRpb24gKG0gKyAwLjUgKyBqaXR0ZXIpLiBTb2x2aW5nIGZvciB0aGUgY2xvc2VzdCB0YXAgZ2l2ZXM6XG5cblx0XHRcdGNvbnN0IGNsb3Nlc3RUYXBGID0gcEluLnN1YiggdmVjMiggMC41ICkuYWRkKCB0aGlzLl9qaXR0ZXJPZmZzZXQgKSApLnJvdW5kKCk7XG5cdFx0XHRjb25zdCBjbG9zZXN0VGFwID0gaXZlYzIoIGNsb3Nlc3RUYXBGICk7XG5cblx0XHRcdC8vIGRlcHRoIGRpbGF0aW9uIGFyb3VuZCB0aGUgY2xvc2VzdCBpbnB1dCB0YXBcblxuXHRcdFx0Y29uc3QgY3VycmVudERlcHRoID0gc2FtcGxlQ3VycmVudERlcHRoKCBjbG9zZXN0VGFwRiApO1xuXHRcdFx0Y29uc3QgY2xvc2VzdERlcHRoID0gY3VycmVudERlcHRoLmdldCggJ2Nsb3Nlc3REZXB0aCcgKTtcblx0XHRcdGNvbnN0IGNsb3Nlc3RQb3NpdGlvblRleGVsID0gY3VycmVudERlcHRoLmdldCggJ2Nsb3Nlc3RQb3NpdGlvblRleGVsJyApO1xuXHRcdFx0Y29uc3QgZmFydGhlc3REZXB0aCA9IGN1cnJlbnREZXB0aC5nZXQoICdmYXJ0aGVzdERlcHRoJyApO1xuXG5cdFx0XHQvLyByZXByb2plY3QgdXNpbmcgdGhlIHZlbG9jaXR5IHNhbXBsZWQgYXQgdGhlIGRpbGF0ZWQgZGVwdGggdGFwXG5cblx0XHRcdGNvbnN0IG9mZnNldFVWID0gdGhpcy52ZWxvY2l0eU5vZGUubG9hZCggY2xvc2VzdFBvc2l0aW9uVGV4ZWwgKS54eS5tdWwoIHZlYzIoIDAuNSwgLSAwLjUgKSApO1xuXHRcdFx0Y29uc3QgaGlzdG9yeVVWID0gdXZOb2RlLnN1Yiggb2Zmc2V0VVYgKTtcblx0XHRcdGNvbnN0IHByZXZpb3VzRGVwdGggPSBzYW1wbGVQcmV2aW91c0RlcHRoKCBoaXN0b3J5VVYgKTtcblxuXHRcdFx0Ly8gaGlzdG9yeSB2YWxpZGl0eVxuXG5cdFx0XHRjb25zdCBpc1ZhbGlkVVYgPSBoaXN0b3J5VVYuZ3JlYXRlclRoYW5FcXVhbCggMCApLmFsbCgpLmFuZCggaGlzdG9yeVVWLmxlc3NUaGFuRXF1YWwoIDEgKS5hbGwoKSApO1xuXHRcdFx0Y29uc3QgaXNFZGdlID0gZmFydGhlc3REZXB0aC5zdWIoIGNsb3Nlc3REZXB0aCApLmdyZWF0ZXJUaGFuKCB0aGlzLmVkZ2VEZXB0aERpZmYgKTtcblx0XHRcdGNvbnN0IGlzRGlzb2NjbHVzaW9uID0gY2xvc2VzdERlcHRoLnN1YiggcHJldmlvdXNEZXB0aCApLmdyZWF0ZXJUaGFuKCB0aGlzLmRlcHRoVGhyZXNob2xkICk7XG5cdFx0XHRjb25zdCBoYXNWYWxpZEhpc3RvcnkgPSBpc1ZhbGlkVVYuYW5kKCBpc0VkZ2Uub3IoIGlzRGlzb2NjbHVzaW9uLm5vdCgpICkgKTtcblxuXHRcdFx0Ly8gOS10YXAgQmxhY2ttYW4tSGFycmlzIChHYXVzc2lhbiBhcHByb3hpbWF0aW9uKSByZWNvbnN0cnVjdGlvblxuXHRcdFx0Ly8gb2YgdGhlIGN1cnJlbnQgZnJhbWUgY29sb3IsIHBsdXMgbW9tZW50IGFjY3VtdWxhdGlvbiBmb3IgdGhlXG5cdFx0XHQvLyB2YXJpYW5jZSBjbGlwIG9mIHRoZSBoaXN0b3J5LlxuXG5cdFx0XHRjb25zdCBzdW1Db2xvciA9IHZlYzQoIDAgKS50b1ZhcigpO1xuXHRcdFx0Y29uc3Qgc3VtV2VpZ2h0ID0gZmxvYXQoIDAgKS50b1ZhcigpO1xuXHRcdFx0Y29uc3QgbW9tZW50MSA9IHZlYzQoIDAgKS50b1ZhcigpO1xuXHRcdFx0Y29uc3QgbW9tZW50MiA9IHZlYzQoIDAgKS50b1ZhcigpO1xuXG5cdFx0XHRjb25zdCBvZmZzZXRzID0gW1xuXHRcdFx0XHRbIC0gMSwgLSAxIF0sIFsgMCwgLSAxIF0sIFsgMSwgLSAxIF0sXG5cdFx0XHRcdFsgLSAxLCAwIF0sIFsgMCwgMCBdLCBbIDEsIDAgXSxcblx0XHRcdFx0WyAtIDEsIDEgXSwgWyAwLCAxIF0sIFsgMSwgMSBdXG5cdFx0XHRdO1xuXG5cdFx0XHRmb3IgKCBjb25zdCBbIHgsIHkgXSBvZiBvZmZzZXRzICkge1xuXG5cdFx0XHRcdGNvbnN0IHRhcCA9IGNsb3Nlc3RUYXAuYWRkKCBpdmVjMiggeCwgeSApICk7XG5cdFx0XHRcdGNvbnN0IHRhcENlbnRlciA9IHZlYzIoIHRhcCApLmFkZCggdmVjMiggMC41ICkuYWRkKCB0aGlzLl9qaXR0ZXJPZmZzZXQgKSApO1xuXHRcdFx0XHRjb25zdCBkZWx0YSA9IHBJbi5zdWIoIHRhcENlbnRlciApO1xuXHRcdFx0XHRjb25zdCBkMiA9IGRlbHRhLmRvdCggZGVsdGEgKTtcblx0XHRcdFx0Y29uc3QgdyA9IGV4cCggZDIubXVsKCAtIDIuMjkgKSApO1xuXG5cdFx0XHRcdC8vIFVzZSBtYXgoKSB0byBwcmV2ZW50IE5hTiB2YWx1ZXMgZnJvbSBwcm9wYWdhdGluZy5cblx0XHRcdFx0Y29uc3QgYyA9IHRoaXMuYmVhdXR5Tm9kZS5sb2FkKCB0YXAgKS5tYXgoIDAgKTtcblxuXHRcdFx0XHRzdW1Db2xvci5hZGRBc3NpZ24oIGMubXVsKCB3ICkgKTtcblx0XHRcdFx0c3VtV2VpZ2h0LmFkZEFzc2lnbiggdyApO1xuXG5cdFx0XHRcdG1vbWVudDEuYWRkQXNzaWduKCBjICk7XG5cdFx0XHRcdG1vbWVudDIuYWRkQXNzaWduKCBjLnBvdzIoKSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRDb2xvciA9IHN1bUNvbG9yLmRpdiggc3VtV2VpZ2h0Lm1heCggMWUtNSApICk7XG5cblx0XHRcdC8vIHZhcmlhbmNlIGNsaXBwaW5nIHVzaW5nIHRoZSBtb21lbnRzIHdlIGp1c3QgZ2F0aGVyZWRcblxuXHRcdFx0Y29uc3QgTiA9IGZsb2F0KCBvZmZzZXRzLmxlbmd0aCApO1xuXHRcdFx0Y29uc3QgbWVhbiA9IG1vbWVudDEuZGl2KCBOICk7XG5cdFx0XHRjb25zdCBtb3Rpb25GYWN0b3IgPSB1dk5vZGUuc3ViKCBoaXN0b3J5VVYgKS5tdWwoIGlucHV0U2l6ZUYgKS5sZW5ndGgoKS5kaXYoIHRoaXMubWF4VmVsb2NpdHlMZW5ndGggKS5zYXR1cmF0ZSgpO1xuXHRcdFx0Y29uc3QgdmFyaWFuY2VHYW1tYSA9IG1peCggMC41LCAxLCBtb3Rpb25GYWN0b3Iub25lTWludXMoKS5wb3cyKCkgKTtcblx0XHRcdGNvbnN0IHZhcmlhbmNlID0gbW9tZW50Mi5kaXYoIE4gKS5zdWIoIG1lYW4ucG93MigpICkubWF4KCAwICkuc3FydCgpLm11bCggdmFyaWFuY2VHYW1tYSApO1xuXHRcdFx0Y29uc3QgbWluQ29sb3IgPSBtZWFuLnN1YiggdmFyaWFuY2UgKTtcblx0XHRcdGNvbnN0IG1heENvbG9yID0gbWVhbi5hZGQoIHZhcmlhbmNlICk7XG5cblx0XHRcdGNvbnN0IGhpc3RvcnlDb2xvciA9IGhpc3RvcnlOb2RlLnNhbXBsZSggaGlzdG9yeVVWICk7XG5cdFx0XHRjb25zdCBjbGlwcGVkSGlzdG9yeUNvbG9yID0gY2xpcEFBQkIoIG1lYW4uY2xhbXAoIG1pbkNvbG9yLCBtYXhDb2xvciApLCBoaXN0b3J5Q29sb3IsIG1pbkNvbG9yLCBtYXhDb2xvciApO1xuXG5cdFx0XHQvLyBDdXJyZW50IHdlaWdodC4gVW5kZXIgVEFBVSBhIHNpbmdsZSBpbnB1dCBmcmFtZSBjb3ZlcnMgbGVzcyBvZlxuXHRcdFx0Ly8gdGhlIG91dHB1dCBncmlkLCBzbyB0aGUgYmFzZWxpbmUgY3VycmVudCB3ZWlnaHQgaXMgbG93ZXIgdGhhblxuXHRcdFx0Ly8gaW4gc3RhbmRhcmQgVFJBQSB0byBnaXZlIHRoZSBhY2N1bXVsYXRvciBtb3JlIGZyYW1lcyB0byBmaWxsXG5cdFx0XHQvLyBpbiBzdWItcGl4ZWwgZGV0YWlsLiBNb3Rpb24gc3RpbGwgYmlhc2VzIHRvd2FyZCB0aGUgY3VycmVudFxuXHRcdFx0Ly8gZnJhbWUgdG8ga2VlcCBkaXNvY2NsdWRlZCBhbmQgZmFzdC1tb3ZpbmcgcGl4ZWxzIHJlc3BvbnNpdmUuXG5cblx0XHRcdGNvbnN0IGN1cnJlbnRMdW1hID0gbHVtaW5hbmNlKCBjdXJyZW50Q29sb3IucmdiICk7XG5cdFx0XHRjb25zdCBtZWFuTHVtYSA9IGx1bWluYW5jZSggbWVhbi5yZ2IgKS50b0NvbnN0KCk7XG5cdFx0XHRjb25zdCB0aGluRmVhdHVyZSA9IGN1cnJlbnRMdW1hLnN1YiggbWVhbkx1bWEgKS5hYnMoKS5kaXYoIG1lYW5MdW1hICkuc21vb3Roc3RlcCggMCwgMC4yICk7XG5cblx0XHRcdC8vIEdhdGUgdGhlIGxvY2sgYnkgYSB0d28tc2lkZWQgZGVwdGggY2hhbmdlIGNoZWNrLiBUaGVcblx0XHRcdC8vIGV4aXN0aW5nIGBpc0Rpc29jY2x1c2lvbmAgaXMgb25lLXNpZGVkIChvbmx5IGZpcmVzIHdoZW5cblx0XHRcdC8vIHRoZSBzY2VuZSBtb3ZlcyBmYXJ0aGVyKSwgYnV0IG5ldyBnZW9tZXRyeSBhcHBlYXJpbmdcblx0XHRcdC8vIGNsb3NlciBhbHNvIG1ha2VzIHRoZSBoaXN0b3J5IHN0YWxlLlxuXHRcdFx0Y29uc3QgaXNEZXB0aENoYW5nZWQgPSBjbG9zZXN0RGVwdGguc3ViKCBwcmV2aW91c0RlcHRoICkuYWJzKCkuZ3JlYXRlclRoYW4oIHRoaXMuZGVwdGhUaHJlc2hvbGQgKTtcblx0XHRcdGNvbnN0IGNhbkxvY2sgPSBpc1ZhbGlkVVYuYW5kKCBpc0RlcHRoQ2hhbmdlZC5ub3QoKSApO1xuXHRcdFx0Y29uc3QgZ2F0ZWRUaGluRmVhdHVyZSA9IGNhbkxvY2suc2VsZWN0KCB0aGluRmVhdHVyZSwgZmxvYXQoIDAgKSApO1xuXG5cdFx0XHRjb25zdCBkZWNheSA9IGlzRGlzb2NjbHVzaW9uLnNlbGVjdCggMCwgMC41ICk7XG5cdFx0XHRjb25zdCBsb2NrID0gbWF4KCBnYXRlZFRoaW5GZWF0dXJlLCBsb2NrTm9kZS5yLm11bCggZGVjYXkgKSApLnNhdHVyYXRlKCk7XG5cdFx0XHRjb25zdCBsb2NrZWRIaXN0b3J5Q29sb3IgPSBtaXgoIGNsaXBwZWRIaXN0b3J5Q29sb3IsIGhpc3RvcnlDb2xvciwgbG9jayApO1xuXG5cdFx0XHRjb25zdCBjdXJyZW50V2VpZ2h0ID0gZmxvYXQoIHRoaXMuY3VycmVudEZyYW1lV2VpZ2h0ICkudG9WYXIoKTtcblx0XHRcdGN1cnJlbnRXZWlnaHQuYXNzaWduKCBoYXNWYWxpZEhpc3Rvcnkuc2VsZWN0KCBjdXJyZW50V2VpZ2h0LmFkZCggbW90aW9uRmFjdG9yICkuc2F0dXJhdGUoKSwgMSApICk7XG5cblx0XHRcdGNvbnN0IG91dHB1dCA9IGZsaWNrZXJSZWR1Y3Rpb24oIGN1cnJlbnRDb2xvciwgbG9ja2VkSGlzdG9yeUNvbG9yLCBjdXJyZW50V2VpZ2h0ICk7XG5cblx0XHRcdGNvbG9yT3V0cHV0LmFzc2lnbiggb3V0cHV0ICk7XG5cdFx0XHRsb2NrT3V0cHV0LmFzc2lnbiggbG9jayApO1xuXG5cdFx0XHRyZXR1cm4gdmVjNCggMCApOyAvLyB0ZW1wb3Jhcnkgc29sdXRpb24gdW50aWwgVFNMIGRvZXMgbm90IGNvbXBsYWluIGFueW1vcmVcblxuXHRcdH0gKTtcblxuXHRcdC8vIG1hdGVyaWFsc1xuXG5cdFx0dGhpcy5fcmVzb2x2ZU1hdGVyaWFsLmNvbG9yTm9kZSA9IHJlc29sdmUoKTtcblx0XHR0aGlzLl9yZXNvbHZlTWF0ZXJpYWwub3V0cHV0Tm9kZSA9IG91dHB1dE5vZGU7XG5cblx0XHR0aGlzLl9zZWVkTWF0ZXJpYWwuY29sb3JOb2RlID0gRm4oICgpID0+IHtcblxuXHRcdFx0Y29sb3JPdXRwdXQuYXNzaWduKCB0aGlzLmJlYXV0eU5vZGUuc2FtcGxlKCB1digpICkgKTtcblx0XHRcdGxvY2tPdXRwdXQuYXNzaWduKCAwICk7XG5cblx0XHRcdHJldHVybiB2ZWM0KCAwICk7XG5cblx0XHR9ICkoKTtcblxuXHRcdHRoaXMuX3NlZWRNYXRlcmlhbC5vdXRwdXROb2RlID0gb3V0cHV0Tm9kZTtcblxuXHRcdHJldHVybiB0aGlzLl90ZXh0dXJlTm9kZTtcblxuXHR9XG5cblx0LyoqXG5cdCAqIEZyZWVzIGludGVybmFsIHJlc291cmNlcy4gVGhpcyBtZXRob2Qgc2hvdWxkIGJlIGNhbGxlZFxuXHQgKiB3aGVuIHRoZSBlZmZlY3QgaXMgbm8gbG9uZ2VyIHJlcXVpcmVkLlxuXHQgKi9cblx0ZGlzcG9zZSgpIHtcblxuXHRcdHRoaXMuX2hpc3RvcnlSZW5kZXJUYXJnZXQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Jlc29sdmVSZW5kZXJUYXJnZXQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3ByZXZpb3VzRGVwdGhSZW5kZXJUYXJnZXQuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fcmVzb2x2ZU1hdGVyaWFsLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zZWVkTWF0ZXJpYWwuZGlzcG9zZSgpO1xuXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBUQUFVTm9kZTtcblxuZnVuY3Rpb24gX2hhbHRvbiggaW5kZXgsIGJhc2UgKSB7XG5cblx0bGV0IGZyYWN0aW9uID0gMTtcblx0bGV0IHJlc3VsdCA9IDA7XG5cdHdoaWxlICggaW5kZXggPiAwICkge1xuXG5cdFx0ZnJhY3Rpb24gLz0gYmFzZTtcblx0XHRyZXN1bHQgKz0gZnJhY3Rpb24gKiAoIGluZGV4ICUgYmFzZSApO1xuXHRcdGluZGV4ID0gTWF0aC5mbG9vciggaW5kZXggLyBiYXNlICk7XG5cblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG5cbn1cblxuY29uc3QgX2hhbHRvbk9mZnNldHMgPSAvKkBfX1BVUkVfXyovIEFycmF5LmZyb20oXG5cdHsgbGVuZ3RoOiAzMiB9LFxuXHQoIF8sIGluZGV4ICkgPT4gWyBfaGFsdG9uKCBpbmRleCArIDEsIDIgKSwgX2hhbHRvbiggaW5kZXggKyAxLCAzICkgXVxuKTtcblxuLyoqXG4gKiBUU0wgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgVEFBVSBub2RlIGZvciBUZW1wb3JhbCBBbnRpLUFsaWFzaW5nIFVwc2NhbGluZy5cbiAqXG4gKiBAdHNsXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7VGV4dHVyZU5vZGV9IGJlYXV0eU5vZGUgLSBUaGUgdGV4dHVyZSBub2RlIHRoYXQgcmVwcmVzZW50cyB0aGUgaW5wdXQgb2YgdGhlIGVmZmVjdC5cbiAqIEBwYXJhbSB7VGV4dHVyZU5vZGV9IGRlcHRoTm9kZSAtIEEgbm9kZSB0aGF0IHJlcHJlc2VudHMgdGhlIHNjZW5lJ3MgZGVwdGguXG4gKiBAcGFyYW0ge1RleHR1cmVOb2RlfSB2ZWxvY2l0eU5vZGUgLSBBIG5vZGUgdGhhdCByZXByZXNlbnRzIHRoZSBzY2VuZSdzIHZlbG9jaXR5LlxuICogQHBhcmFtIHtDYW1lcmF9IGNhbWVyYSAtIFRoZSBjYW1lcmEgdGhlIHNjZW5lIGlzIHJlbmRlcmVkIHdpdGguXG4gKiBAcmV0dXJucyB7VEFBVU5vZGV9XG4gKi9cbmV4cG9ydCBjb25zdCB0YWF1ID0gKCBiZWF1dHlOb2RlLCBkZXB0aE5vZGUsIHZlbG9jaXR5Tm9kZSwgY2FtZXJhICkgPT4gbmV3IFRBQVVOb2RlKCBjb252ZXJ0VG9UZXh0dXJlKCBiZWF1dHlOb2RlICksIGRlcHRoTm9kZSwgdmVsb2NpdHlOb2RlLCBjYW1lcmEgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7OztBQUdBLElBQU0sMEJBQTBCLElBQUksU0FBUztBQUM3QyxJQUFNLHNCQUFzQixJQUFJLFFBQVE7QUFFeEMs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