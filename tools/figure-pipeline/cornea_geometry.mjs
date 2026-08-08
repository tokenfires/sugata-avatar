/**
 * Measures whether an eyeball asset actually has a corneal dome.
 *
 * Shared by the asset gate (`verify_glb.mjs`) and the spike that first asked the question
 * (`../spikes/eye-geometry.mjs`) so the two cannot drift apart and report different numbers for
 * the same file. The spike keeps its own independent instrumentation for everything else; this
 * module is only the one measurement they both have to agree on.
 *
 * WHY THE OBVIOUS MEASUREMENT DOES NOT WORK
 *
 * The first version of this test, in the spike, compared the mean radius of the frontmost angular
 * bin against the mean radius of the equatorial bin, and called the difference signal only if it
 * exceeded three times the RMS residual of a sphere fitted to the *whole* shell.
 *
 * That is the right question and the wrong noise estimate, and it fails in both directions:
 *
 *   - On a domed shell the dome itself is most of that residual. Fitting one sphere to a surface
 *     that is deliberately two radii inflates the very number the bulge is compared against.
 *     Measured on the shipped high-poly cornea: bulge 0.494 mm against a whole-shell residual RMS
 *     of 0.319 mm, so the old form reads 0.494 < 3 x 0.319 and calls a real cornea a sphere.
 *   - It also silently assumes the shell has an equator. A 120-degree cap does not.
 *
 * So the noise estimate is taken where there is no cornea by construction: fit a sphere to the
 * POSTERIOR BAND only — everything more than POSTERIOR_BAND_MIN_DEGREES off the forward axis, which
 * is sclera — and then ask how far the front cap sits outside that sphere. That fit's own RMS is a
 * clean read of tessellation noise, because nothing in the band is trying to be a second radius.
 *
 * Sanity-checked in both directions against real assets, which is the only thing that makes it
 * trustworthy (docs/LEARNINGS.md 1.1):
 *
 *   high-poly cornea shell   front cap sits  +0.688 mm outside the posterior sphere, RMS 0.202 mm
 *   low-poly single shell    front cap sits  -0.015 mm outside the posterior sphere, RMS 0.191 mm
 *
 * A dome and a sphere, 46x apart on the measurement, where the old form separated them by 10x and
 * put the threshold between the wrong pair. `build_figure.py --eye-proxy low-poly.mhclo` rebuilds
 * the known-bad figure whenever that claim needs re-checking.
 */

// The frontmost cap. 15 degrees on a 15.3 mm globe is a 4.0 mm chord, which is inside the ~5.5 mm
// the corneal dome spans on this asset, so the cap samples dome and only dome.
export const FRONT_CAP_DEGREES = 15;

// Where the sclera starts, for the purpose of fitting a reference sphere to it. Beyond 30 degrees
// the high-poly cornea shell's radius is flat to within 0.4 mm across 90 degrees of arc.
export const POSTERIOR_BAND_MIN_DEGREES = 30;

// How far above its own fit noise the front cap has to sit before it counts as a dome. Three
// standard deviations, the same rule the spike's clause has always stated — only now applied to a
// noise estimate that is actually noise.
export const DOME_NOISE_MULTIPLE = 3;

/**
 * Algebraic least-squares sphere.
 *
 * Writing |v - c|^2 = R^2 as |v|^2 = 2c.v + (R^2 - |c|^2) makes the problem linear in (c, k), so a
 * 4x4 normal-equation solve gives the exact minimiser of the algebraic residual in one step. Same
 * derivation as the spike's, kept here so the gate does not depend on a spike.
 */
export function fitSphere( points ) {

  const normal = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ];
  const rightHandSide = [ 0, 0, 0, 0 ];

  for ( const [ x, y, z ] of points ) {
    const row = [ 2 * x, 2 * y, 2 * z, 1 ];
    const value = x * x + y * y + z * z;
    for ( let r = 0; r < 4; r ++ ) {
      for ( let c = 0; c < 4; c ++ ) normal[ r ][ c ] += row[ r ] * row[ c ];
      rightHandSide[ r ] += row[ r ] * value;
    }
  }

  const solution = solveLinearSystem( normal, rightHandSide );
  const centre = [ solution[ 0 ], solution[ 1 ], solution[ 2 ] ];
  const radius = Math.sqrt( solution[ 3 ] + centre[ 0 ] ** 2 + centre[ 1 ] ** 2 + centre[ 2 ] ** 2 );

  const residuals = points.map( ( point ) => distance( point, centre ) - radius );
  const residualRms = Math.sqrt(
    residuals.reduce( ( total, value ) => total + value * value, 0 ) / residuals.length );

  return { centre, radius, residualRms, count: points.length };

}

/** Gauss-Jordan with partial pivoting. Four unknowns; nothing more elaborate is warranted. */
function solveLinearSystem( matrix, vector ) {

  const augmented = matrix.map( ( row, index ) => [ ...row, vector[ index ] ] );
  const size = vector.length;

  for ( let column = 0; column < size; column ++ ) {
    let pivot = column;
    for ( let row = column + 1; row < size; row ++ ) {
      if ( Math.abs( augmented[ row ][ column ] ) > Math.abs( augmented[ pivot ][ column ] ) ) pivot = row;
    }
    [ augmented[ column ], augmented[ pivot ] ] = [ augmented[ pivot ], augmented[ column ] ];

    for ( let row = 0; row < size; row ++ ) {
      if ( row === column ) continue;
      const factor = augmented[ row ][ column ] / augmented[ column ][ column ];
      for ( let k = column; k <= size; k ++ ) augmented[ row ][ k ] -= factor * augmented[ column ][ k ];
    }
  }

  return augmented.map( ( row, index ) => row[ size ] / row[ index ] );

}

/**
 * The dome measurement, in millimetres, for one eye's worth of shell vertices.
 *
 * `forwardAxis` is the direction the cornea faces, a unit vector in the same space as the points.
 * The figure is exported Y-up facing +Z, and the spike measures the cap axis at under 10 degrees
 * off +Z, so the caller passes [0, 0, 1] rather than this module guessing.
 */
export function measureCornealDome( points, forwardAxis = [ 0, 0, 1 ] ) {

  const wholeShell = fitSphere( points );

  const withAngle = points.map( ( point ) => ( {
    point,
    degrees: angleFromAxisDegrees( point, wholeShell.centre, forwardAxis )
  } ) );

  const posterior = withAngle
    .filter( ( entry ) => entry.degrees >= POSTERIOR_BAND_MIN_DEGREES )
    .map( ( entry ) => entry.point );
  const frontCap = withAngle
    .filter( ( entry ) => entry.degrees < FRONT_CAP_DEGREES )
    .map( ( entry ) => entry.point );

  if ( posterior.length < 4 || frontCap.length < 1 ) {
    return { measured: false, posteriorCount: posterior.length, frontCapCount: frontCap.length };
  }

  const posteriorFit = fitSphere( posterior );

  const proud = frontCap.map( ( point ) =>
    distance( point, posteriorFit.centre ) - posteriorFit.radius );

  const meanProudMm = proud.reduce( ( total, value ) => total + value, 0 ) / proud.length * 1000;
  const noiseMm = posteriorFit.residualRms * 1000;

  return {
    measured: true,
    wholeShellRadiusMm: wholeShell.radius * 1000,
    wholeShellResidualRmsMm: wholeShell.residualRms * 1000,
    posteriorRadiusMm: posteriorFit.radius * 1000,
    posteriorCount: posterior.length,
    noiseMm,
    frontCapCount: frontCap.length,
    meanProudMm,
    maxProudMm: Math.max( ...proud ) * 1000,
    domeRatio: noiseMm === 0 ? Infinity : meanProudMm / noiseMm,
    hasDome: meanProudMm > DOME_NOISE_MULTIPLE * noiseMm
  };

}

/**
 * How far in front of the globe's frontmost point the cornea's frontmost point sits — the anterior
 * chamber, in millimetres.
 *
 * This is the measurement that needs no fitting and no threshold argument: either there are two
 * surfaces with a gap between them for a ray to be refracted across, or there is one surface.
 */
export function measureAnteriorChamberMm( corneaPoints, globePoints, forwardAxis = [ 0, 0, 1 ] ) {

  const furthestForward = ( points ) => Math.max( ...points.map( ( point ) => dot( point, forwardAxis ) ) );

  return ( furthestForward( corneaPoints ) - furthestForward( globePoints ) ) * 1000;

}

/**
 * Splits a two-eye point cloud into the figure's own left and right, on the sign of x about the
 * cloud's mean. The eyes are an interpupillary distance apart and each is 30 mm wide, so this is
 * reading a gap, not making a judgement call.
 */
export function splitIntoEyes( points ) {

  const meanX = points.reduce( ( total, point ) => total + point[ 0 ], 0 ) / points.length;

  return {
    left: points.filter( ( point ) => point[ 0 ] > meanX ),
    right: points.filter( ( point ) => point[ 0 ] <= meanX )
  };

}

/** Every vertex position of a three.js BufferGeometry, as plain [x, y, z] triples. */
export function positionsOf( geometry ) {

  const position = geometry.attributes.position;
  const points = [];
  for ( let index = 0; index < position.count; index += 1 ) {
    points.push( [ position.getX( index ), position.getY( index ), position.getZ( index ) ] );
  }
  return points;

}

function angleFromAxisDegrees( point, centre, axis ) {

  const offset = [ point[ 0 ] - centre[ 0 ], point[ 1 ] - centre[ 1 ], point[ 2 ] - centre[ 2 ] ];
  const length = Math.hypot( ...offset );
  const cosine = Math.max( -1, Math.min( 1, dot( offset, axis ) / length ) );
  return Math.acos( cosine ) * 180 / Math.PI;

}

function dot( a, b ) {
  return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
}

function distance( a, b ) {
  return Math.hypot( a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] );
}
