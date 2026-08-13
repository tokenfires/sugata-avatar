// Dynamic Follow-The-Leader hair solver, in TSL compute, for spike 6.6/9.14.
//
// This module is the SPIKE's solver. It writes no production code and it is deliberately
// self-contained: given a groom described as `chains × pointsPerChain` centreline positions
// plus a per-ring half-width, it builds the storage buffers, the compute kernels and the
// node that a card mesh reads its vertex positions from.
//
// The algorithm is Müller, Kim & Chentanez, "Fast Simulation of Inextensible Hair and Fur",
// VRIPHYS 2012 (read off the PDF at matthias-research.github.io — see
// docs/research/hair-motion.md §2 for the equations and the page they are on):
//
//   §3.2 eq 1–4  PBD step:   p ← x + Δt·v + Δt²·f ;  p ← project(p) ;  v ← (p−x)/Δt ;  x ← p
//   §3.1         FTL:        particle i is moved onto the sphere of radius l₀ about particle
//                            i−1, and i−1 is NOT moved. One pass, exact inextensibility.
//   §3.3 eq 9    DFTL:       v_i ← (p_i − x_i)/Δt + s_damping · (−d_{i+1}/Δt), which is the
//                            paper's whole contribution: it hides FTL's implied infinite mass
//                            ratio at the cost of some numerical damping.
//
// Two things are borrowed from AMD's TressFX 4.1 `TressFXSimulation.hlsl` (read off the file at
// GPUOpen-Effects/TressFX@master; §3 of the research doc quotes both):
//
//   - the GLOBAL SHAPE CONSTRAINT, `p += stiffness · (restWorld − p)` applied only over the
//     first `range` fraction of the strand (`IntegrationAndGlobalShapeConstraints`, lines 655–658
//     of TressFXSimulation.hlsl at GPUOpen-Effects/TressFX@master).
//     Without it a bob falls into a curtain in about a second and never comes back — it is
//     what makes a simulated groom keep the shape it was authored with.
//   - ONE THREAD PER STRAND for anything sequential (`CalcIndicesInStrandLevel*`). A strand is
//     only 17 particles here, and FTL is inherently sequential along the chain, so the whole
//     chain living in one invocation removes every barrier the constraint solve would need.
//
// What is NOT here, and is named so nobody reads its absence as a claim: local shape/bend
// constraints, hair–hair repulsion, wind, and SDF collision. The collider is one sphere and one
// capsule, which is what the head and the shoulders need and no more.

import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, instancedArray, instanceIndex, uniform,
  vec3, vec4, float, uint, cross, normalize, length, min, clamp, cos, sin
} from 'three/tsl';

/**
 * Builds the solver for one groom.
 *
 * @param {Object} groom
 * @param {number} groom.chainCount
 * @param {number} groom.pointsPerChain
 * @param {Float32Array} groom.restPositions - chainCount·pointsPerChain vec3, HEAD-LOCAL.
 * @param {Float32Array} groom.halfWidths - chainCount·pointsPerChain floats, ribbon half-width.
 * @param {Float32Array} groom.twists - chainCount floats, radians root to tip.
 * @returns {Object} buffers, kernels and the uniforms the page drives.
 */
export function createDftlSolver( groom ) {

  const { chainCount, pointsPerChain, restPositions, halfWidths, twists } = groom;
  const particleCount = chainCount * pointsPerChain;

  // --- state -------------------------------------------------------------------------------

  const positionBuffer = instancedArray( new Float32Array( restPositions ), 'vec3' );
  const velocityBuffer = instancedArray( particleCount, 'vec3' );
  const restBuffer = instancedArray( new Float32Array( restPositions ), 'vec3' );

  // FTL's correction vector d_i, kept because eq 9 needs d_{i+1} when it gets to particle i.
  // One invocation owns a whole chain, so this is scratch that never crosses a thread boundary
  // — a local array would do the same job and cost the same registers; a buffer is legible.
  const correctionBuffer = instancedArray( particleCount, 'vec3' );

  // Rest segment length per chain. `hair_cards.resample` spaces a guide's rings uniformly along
  // its own arc, so the rest length really is constant along a chain and one float per chain is
  // the whole story — measured off the first segment rather than assumed.
  const segmentLengths = new Float32Array( chainCount );
  for ( let chain = 0; chain < chainCount; chain ++ ) {
    const base = chain * pointsPerChain * 3;
    segmentLengths[ chain ] = Math.hypot(
      restPositions[ base + 3 ] - restPositions[ base + 0 ],
      restPositions[ base + 4 ] - restPositions[ base + 1 ],
      restPositions[ base + 5 ] - restPositions[ base + 2 ]
    );
  }
  const segmentLengthBuffer = instancedArray( segmentLengths, 'float' );

  // Ribbon output: two vertices per ring, in the order the card geometry indexes them.
  const cardVertexBuffer = instancedArray( particleCount * 2, 'vec3' );
  const halfWidthBuffer = instancedArray( new Float32Array( halfWidths ), 'float' );
  const twistBuffer = instancedArray( new Float32Array( twists ), 'float' );

  // --- uniforms ----------------------------------------------------------------------------

  const uniforms = {
    headMatrix: uniform( new THREE.Matrix4() ),
    // The head's own centre, in world space. `ribbon_of` builds the card's across-vector from
    // "outward from the head centre" rather than from the scalp normal, and the rebuild has to
    // use the same reference or every card twists the moment the solver moves it.
    headCentre: uniform( new THREE.Vector3() ),
    deltaTime: uniform( 1 / 60 ),
    gravity: uniform( new THREE.Vector3( 0, - 9.81, 0 ) ),
    // FTL paper §3.3: s_damping ∈ [0,1]; 1 fully compensates the uneven masses and damps most,
    // "smaller but close to 1" is the paper's own recommendation and Figure 4 shows 0.9.
    dampingScale: uniform( 0.9 ),
    // TressFX's g_Shape.z / g_Shape.w. No default ships in the shader; these are chosen here.
    globalStiffness: uniform( 0.30 ),
    globalRange: uniform( 1.0 ),
    // Skull collider and a shoulder capsule, both in world space.
    skull: uniform( new THREE.Vector4( 0, 0, 0, 0.10 ) ),
    capsuleA: uniform( new THREE.Vector3() ),
    capsuleB: uniform( new THREE.Vector3() ),
    capsuleRadius: uniform( 0.06 ),
    collideEnabled: uniform( 1 ),
    // TressFX's `g_ResetPositions`, and it is here for the same reason: a sweep that changes
    // variant must not measure the previous variant's blow-up settling down. Set it for one
    // dispatch and the chain snaps back to the skinned rest pose with zero velocity.
    resetPositions: uniform( 0 ),
    // 🚩 The spike's own red proof. Setting this to 0 keeps every other term — prediction,
    // gravity, the global shape constraint, the colliders — and removes ONLY the FTL
    // projection, which is the single line that makes the strand inextensible. The
    // segment-length check below has to go red when it is off, or the check is measuring
    // something other than the solver.
    ftlEnabled: uniform( 1 )
  };

  const POINTS = uint( pointsPerChain );

  /** Rest position i of the current chain, moved into world space by the head transform. */
  const restWorldAt = ( index ) =>
    uniforms.headMatrix.mul( vec4( restBuffer.element( index ), 1 ) ).xyz;

  /** Pushes `point` out of the skull sphere and the shoulder capsule. Returns the new point. */
  const resolveColliders = Fn( ( [ point ] ) => {
    const result = vec3( point ).toVar();

    // Sphere.
    const toCentre = result.sub( uniforms.skull.xyz ).toVar();
    const distance = length( toCentre ).max( 1e-6 ).toVar();
    If( distance.lessThan( uniforms.skull.w ), () => {
      result.assign( uniforms.skull.xyz.add( toCentre.div( distance ).mul( uniforms.skull.w ) ) );
    } );

    // Capsule: closest point on the segment, then the same push-out.
    const axis = uniforms.capsuleB.sub( uniforms.capsuleA ).toVar();
    const t = clamp( result.sub( uniforms.capsuleA ).dot( axis ).div( axis.dot( axis ).max( 1e-9 ) ), 0, 1 );
    const onAxis = uniforms.capsuleA.add( axis.mul( t ) ).toVar();
    const toAxis = result.sub( onAxis ).toVar();
    const axisDistance = length( toAxis ).max( 1e-6 ).toVar();
    If( axisDistance.lessThan( uniforms.capsuleRadius ), () => {
      result.assign( onAxis.add( toAxis.div( axisDistance ).mul( uniforms.capsuleRadius ) ) );
    } );

    return result;
  } ).setLayout( {
    name: 'resolveColliders',
    type: 'vec3',
    inputs: [ { name: 'point', type: 'vec3' } ]
  } );

  // --- kernel 1: the DFTL step -------------------------------------------------------------
  //
  // One invocation per chain. It walks the chain root-to-tip once, which is exactly what FTL
  // is, and then walks it a second time to apply eq 9's correction — the second walk exists
  // only because d_{i+1} is not known when particle i's velocity is first written.

  const solveKernel = Fn( () => {

    const base = instanceIndex.mul( POINTS );
    const restLength = segmentLengthBuffer.element( instanceIndex ).toVar();
    const dt = uniforms.deltaTime.toVar();

    // The root is kinematic: it is wherever the skull put it this frame. This is the whole
    // input to the simulation — everything else follows from the root moving.
    const root = restWorldAt( base ).toVar();
    positionBuffer.element( base ).assign( root );
    velocityBuffer.element( base ).assign( vec3( 0 ) );
    correctionBuffer.element( base ).assign( vec3( 0 ) );

    const previous = vec3( root ).toVar();

    Loop( { start: uint( 1 ), end: POINTS, type: 'uint', condition: '<' }, ( { i } ) => {

      const index = base.add( i );
      const x = positionBuffer.element( index ).toVar();
      const v = velocityBuffer.element( index ).toVar();

      If( uniforms.resetPositions.greaterThan( 0 ), () => {
        x.assign( restWorldAt( index ) );
        v.assign( vec3( 0 ) );
      } );

      // PBD eq 1: unconstrained prediction under gravity.
      const p = x.add( v.mul( dt ) ).add( uniforms.gravity.mul( dt ).mul( dt ) ).toVar();

      // TressFX global shape constraint, over the root end of the strand only.
      const alongStrand = float( i ).div( float( POINTS ) );
      If( alongStrand.lessThan( uniforms.globalRange ), () => {
        p.addAssign( restWorldAt( index ).sub( p ).mul( uniforms.globalStiffness ) );
      } );

      If( uniforms.collideEnabled.greaterThan( 0 ), () => {
        p.assign( resolveColliders( p ) );
      } );

      // FTL: onto the sphere of radius l₀ about the predecessor. The predecessor does not move,
      // which is what makes one pass exact rather than one iteration of something convergent.
      const toPrevious = p.sub( previous ).toVar();
      const separation = length( toPrevious ).max( 1e-6 ).toVar();
      const projected = previous.add( toPrevious.div( separation ).mul( restLength ) ).toVar();
      const correction = projected.sub( p ).toVar();

      If( uniforms.ftlEnabled.lessThan( 1 ), () => {
        projected.assign( p );
        correction.assign( vec3( 0 ) );
      } );

      positionBuffer.element( index ).assign( projected );
      correctionBuffer.element( index ).assign( correction );
      velocityBuffer.element( index ).assign( projected.sub( x ).div( dt ) );

      previous.assign( projected );

    } );

    // DFTL eq 9's second term. Particle P−1 has no successor, so it keeps the plain velocity.
    Loop( { start: uint( 1 ), end: POINTS.sub( uint( 1 ) ), type: 'uint', condition: '<' }, ( { i } ) => {
      const index = base.add( i );
      const successorCorrection = correctionBuffer.element( index.add( uint( 1 ) ) );
      velocityBuffer.element( index ).addAssign(
        successorCorrection.mul( uniforms.dampingScale.negate() ).div( dt )
      );
    } );

  } )().compute( chainCount ).setName( 'DFTL step' );

  // --- kernel 2: rebuild the ribbon --------------------------------------------------------
  //
  // One invocation per ring. This is `hair_cards.py: ribbon_of` re-expressed on the GPU and it
  // has to stay that way: the card's frame is (tangent, outward-from-head-centre), twisted by
  // the card's own constant, and any other frame makes the groom rotate when the solver runs.

  const skinKernel = Fn( () => {

    const chain = instanceIndex.div( POINTS );
    const ring = instanceIndex.mod( POINTS );

    const centre = positionBuffer.element( instanceIndex ).toVar();

    // Central difference, one-sided at the ends — the generator's own tangent rule.
    const beforeIndex = instanceIndex.sub( min( ring, uint( 1 ) ) );
    const afterIndex = instanceIndex.add( min( POINTS.sub( ring ).sub( uint( 1 ) ), uint( 1 ) ) );
    const tangent = normalize(
      positionBuffer.element( afterIndex ).sub( positionBuffer.element( beforeIndex ) )
        .add( vec3( 0, 1e-7, 0 ) )
    ).toVar();

    const radial = centre.sub( uniforms.headCentre ).toVar();
    const outward = normalize(
      radial.sub( tangent.mul( radial.dot( tangent ) ) ).add( vec3( 1e-7, 0, 0 ) )
    ).toVar();

    const angle = twistBuffer.element( chain ).mul( float( ring ).div( float( POINTS.sub( uint( 1 ) ) ) ) );
    const across = normalize(
      cross( tangent, outward ).mul( cos( angle ) ).add( outward.mul( sin( angle ) ) )
    ).toVar();

    const half = halfWidthBuffer.element( instanceIndex ).toVar();
    const offset = across.mul( half ).toVar();

    cardVertexBuffer.element( instanceIndex.mul( uint( 2 ) ) ).assign( centre.sub( offset ) );
    cardVertexBuffer.element( instanceIndex.mul( uint( 2 ) ).add( uint( 1 ) ) ).assign( centre.add( offset ) );

  } )().compute( particleCount ).setName( 'Card rebuild' );

  return {
    chainCount,
    pointsPerChain,
    particleCount,
    uniforms,
    positionBuffer,
    velocityBuffer,
    cardVertexBuffer,
    solveKernel,
    skinKernel
  };

}
