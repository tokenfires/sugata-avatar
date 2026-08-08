#!/usr/bin/env node
//
// eye-geometry.mjs — does the shipped eyeball geometry support an HDRP-style cornea-refraction
// eye shader (punch-list 3.3), or does the asset have to change first?
//
// `docs/research/eyes-and-lighting.md` §1 records a *geometry contract*, not just an algorithm.
// The 40 lines of TSL everyone is excited about only work if the mesh underneath them satisfies it:
//
//   - one eye per object, authored with the cornea facing +Z in its own object space
//   - XY roughly in [-0.5, 0.5] — i.e. the eye is unit-ish and centred on its own origin
//   - a real corneal dome at the front, "an almost egg-like shape", NOT a sphere
//   - sclera UV = "literally the object-space XY", a planar projection along the cornea axis
//   - a flat iris plane at z = -IRIS_PLANE_OFFSET (0.02), iris radius 0.22
//
// Every one of those is a measurable property of `assets/figures/figure_g050.glb`, and none of them
// can be settled by reading the mesh's name. `docs/LEARNINGS.md` already records the trap: the
// eyeballs are named for their topology rather than their anatomy. So this file measures, and where
// it cannot measure it says so.
//
// WHAT THIS SPIKE FOUND, AND WHAT CHANGED BECAUSE OF IT
//
// Run against the original asset — MakeHuman's `low-poly` eye proxy — six of eight clauses failed,
// and one of them was not something a shader could work around: there was no corneal dome at all.
// Front-versus-equator bulge 0.051 mm against 0.158 mm of tessellation noise, and a flat octagonal
// facet recessed 0.131 mm inside the sphere exactly where the pupil goes.
//
// The pipeline now builds with MakeHuman's `high-poly` proxy instead, which is TWO MESHES per
// figure: `Human.high-poly`, the opaque globe carrying the iris, the pupil and the sclera, and
// `Human.cornea`, a clear shell over it split off onto a transmissive material by
// `tools/figure-pipeline/build_figure.py`. This file measures the cornea for everything to do with
// the refracting surface and the globe for everything to do with the iris, and still reports the
// same eight clauses so the before and after are comparable.
//
// The single most important number here is the sphere-fit residual and the radius-versus-angle
// table in §3. A corneal dome shows up there as a radius that climbs by millimetres as the angle
// from the forward axis goes to zero. A plain sphere shows a flat line. No bulge means there is no
// refracting surface to trace a ray through, and the whole technique changes shape.
//
// This is a SPIKE. It answers a question and writes nothing but stdout. It does not start a server,
// does not render, and does not touch the figure.
//
// Usage:
//   node "tools/spikes/eye-geometry.mjs"
//   node "tools/spikes/eye-geometry.mjs" assets/figures/figure_g100.glb

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures: it reads `self.URL` and
// hands the resulting blob URL to createImageBitmap. Nothing here inspects pixels *through three*
// — §6 decodes the eye texture straight out of the GLB instead — so the two smallest possible
// stubs get the loader to the geometry. They must be in place before the dynamic imports below.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );
const { Box3, Vector3 } = await import( 'three' );
const { decodePng } = await import( '../critic/png.mjs' );

// The dome test itself lives with the asset gate that now enforces it, so the spike and the gate
// cannot drift apart and report different answers about the same file.
const { measureCornealDome, measureAnteriorChamberMm, DOME_NOISE_MULTIPLE, FRONT_CAP_DEGREES,
  POSTERIOR_BAND_MIN_DEGREES } = await import( '../figure-pipeline/cornea_geometry.mjs' );

const REPOSITORY_ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
const DEFAULT_FIGURE = path.join( REPOSITORY_ROOT, 'assets', 'figures', 'figure_g050.glb' );

// MakeHuman names the eyeball proxy for its topology. verify_glb.mjs matches the same way and for
// the same reason: matching on /eye/ finds the lashes and the brows and never finds the eyeballs.
// 'low-poly' stays in the globe pattern so this spike still runs against a figure built with the
// superseded proxy — which is how the before-and-after in the header was measured.
const EYEBALL_GLOBE_PATTERN = /high-poly|low-poly|eyeball/i;
const EYEBALL_CORNEA_PATTERN = /cornea/i;

// The HDRP constants, quoted from the research doc so the conversion in §5 has something to
// convert. They live in a normalised space where the eye's XY half-extent is 0.5.
const HDRP = {
  irisRadius: 0.22,
  irisPlaneOffset: 0.02,
  corneaIor: 1.3333,
  xyHalfExtent: 0.5
};

// Human anatomy, for the scale check. Adult eyeball axial length is ~24 mm, i.e. ~12 mm radius.
// Quoted as a single figure because that is all §5 needs — this is a sanity check on units, not a
// biometric claim, and the spike does not pretend to a tolerance it did not measure.
const HUMAN_EYEBALL_RADIUS_MM = 12.0;

const GLB_MAGIC = 0x46546c67;       // "glTF"
const CHUNK_TYPE_JSON = 0x4e4f534a; // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942;  // "BIN\0"

// §3's angular bins. 15° is the finest bin this mesh can support: it carries 48 vertices per eye in
// six rings, so a 5° bin would put most bins at n=0 and invite reading noise as structure.
const ANGLE_BIN_DEGREES = 15;

// §6's iris detector, calibrated against the image rather than against an assumption about it.
//
// The first version of this used absolute thresholds — "sclera is near-white" — and classified
// 100% of the square as iris, because the shipped sclera is a warm mid-grey around RGB 163,156,146
// and not white at all. So the thresholds are now stated RELATIVE to the square's own medians. The
// sclera is the majority of every eye square by a wide margin, which makes the median a reliable
// stand-in for "what does sclera look like here" without needing to segment anything first.
//
// An iris texel is one that is markedly more saturated than the median (the coloured ring) or
// markedly darker than it (the pupil, which is unsaturated black and would otherwise be missed).
const IRIS_SATURATION_MARGIN = 0.10;  // above the square's median saturation
const IRIS_LUMA_FRACTION = 0.65;      // below this fraction of the square's median luma

// The preview grid printed per eye. 40 rows is about as coarse as a 1024² map can be shown and
// still have the iris read as a disc rather than a blob.
const PREVIEW_CELLS = 40;

main();

function main() {

  const figurePath = process.argv[ 2 ]
    ? path.resolve( process.cwd(), process.argv[ 2 ] )
    : DEFAULT_FIGURE;

  const fileBytes = fs.readFileSync( figurePath );

  heading( `eye geometry — ${ path.relative( REPOSITORY_ROOT, figurePath ) }` );

  loadScene( fileBytes ).then( ( scene ) => {

    const container = readGlbContainer( fileBytes );
    const globeMesh = findMesh( scene, EYEBALL_GLOBE_PATTERN );
    const corneaMesh = findMesh( scene, EYEBALL_CORNEA_PATTERN );

    if ( globeMesh === null ) {
      console.log( `NOT MEASURED: no mesh matching ${ EYEBALL_GLOBE_PATTERN } in this file.` );
      process.exitCode = 2;
      return;
    }

    // The refracting surface is the cornea where there is one. On a single-shell figure the globe
    // IS the outer surface, and measuring it is what produced the finding in the header.
    const refractingMesh = corneaMesh ?? globeMesh;
    const eyes = splitIntoEyes( refractingMesh );
    const globeEyes = corneaMesh === null ? eyes : splitIntoEyes( globeMesh );

    reportMeshTopology( scene, refractingMesh, globeMesh, corneaMesh, eyes );
    reportPlacementAndFacing( refractingMesh, eyes );
    reportShape( eyes, globeEyes, corneaMesh !== null );
    reportUvs( globeEyes );
    reportScale( scene, refractingMesh, eyes );
    const irisDisc = reportMaterialAndTextures( container, refractingMesh, globeMesh, globeEyes );
    const gaze = reportMorphDisplacement( globeMesh, globeEyes, corneaMesh, eyes );
    reportDerivedConstants( eyes, irisDisc );
    reportVerdict( eyes, globeEyes, corneaMesh !== null, irisDisc, gaze );

  } ).catch( ( error ) => {
    console.error( '\neye-geometry.mjs failed:', error );
    process.exitCode = 2;
  } );

}

// --- 1. one mesh or two ---------------------------------------------------------------------

/**
 * Prints what the eyeball mesh actually *is* as a draw call, which is the thing a shader author
 * has to plan around. "Two eyes" can mean two Object3Ds, two glTF primitives under one mesh, two
 * draw groups in one buffer, or — as here — two disconnected islands sharing every attribute
 * array and one material. Only the last case forces the shader to re-derive which eye a fragment
 * belongs to at runtime, so the distinction is worth spelling out rather than counting objects.
 */
function reportMeshTopology( scene, eyeMesh, globeMesh, corneaMesh, eyes ) {

  heading( '1. one mesh or two' );

  const meshNames = [];
  scene.traverse( ( object ) => { if ( object.isMesh === true ) meshNames.push( object.name ); } );

  row( 'scene meshes', meshNames.join( ', ' ) );
  row( 'eyeball globe', `${ globeMesh.name }  ${ globeMesh.geometry.attributes.position.count } verts` );
  row( 'corneal shell', corneaMesh === null
    ? 'ABSENT — this figure has a single-shell eye and nothing to refract through'
    : `${ corneaMesh.name }  ${ corneaMesh.geometry.attributes.position.count } verts` );
  console.log();
  console.log( '  Everything below measures the REFRACTING surface, which is the cornea where there' );
  console.log( '  is one. §6 and §7 go back to the globe, because the iris lives there.' );
  console.log();
  row( 'measured here', `${ eyeMesh.name }  (${ eyeMesh.type })` );
  row( 'geometry groups', `${ eyeMesh.geometry.groups.length }  (0 = a single draw range, one material)` );
  row( 'materials', Array.isArray( eyeMesh.material )
    ? eyeMesh.material.map( ( material ) => material.name ).join( ', ' )
    : eyeMesh.material.name );
  row( 'vertices (both eyes)', String( eyeMesh.geometry.attributes.position.count ) );
  row( 'triangles (both eyes)', String( eyeMesh.geometry.index.count / 3 ) );
  row( 'duplicate positions (UV seams)', `${ eyes.duplicatePositionCount } of ` +
    `${ eyeMesh.geometry.attributes.position.count }  — welded before anything below is measured` );
  row( 'connected islands, welded', `${ eyes.islandCount }  (sizes ${ eyes.islandSizes.join( ', ' ) })` );

  console.log();
  table(
    [ 'eye', 'verts', 'index range', 'tris', 'boundary edges', 'boundary loops' ],
    eyes.map( ( eye ) => [
      eye.label,
      String( eye.vertices.length ),
      `${ eye.firstIndex }..${ eye.lastIndex }`,
      String( eye.triangleCount ),
      String( eye.boundaryEdgeCount ),
      String( eye.boundaryLoopCount )
    ] )
  );

  // Whether the two islands are one shape mirrored decides whether a shader can carry a single set
  // of per-eye constants and flip the sign of x, or needs two.
  const mirror = measureMirrorMismatch( eyes );
  console.log();
  row( 'mirror check (left vs right in −X)', `max vertex mismatch ${ ( mirror.maxMm ).toFixed( 5 ) } mm, ` +
    `RMS ${ ( mirror.rmsMm ).toFixed( 5 ) } mm` );
  row( 'vertex order', mirror.parallelOrder
    ? 'PARALLEL — vertex i of one eye mirrors vertex i of the other, in order'
    : 'not parallel — matched by nearest neighbour' );

}

/**
 * Compares one eye against the other reflected through the x = 0 plane. Tries the parallel index
 * pairing first, since a mirrored duplicate normally keeps its vertex order, and falls back to
 * nearest neighbour so the number stays meaningful if it does not.
 */
function measureMirrorMismatch( eyes ) {

  const [ first, second ] = eyes;
  if ( first.points.length !== second.points.length ) {
    return { maxMm: NaN, rmsMm: NaN, parallelOrder: false };
  }

  const reflected = second.points.map( ( [ x, y, z ] ) => [ -x, y, z ] );

  const parallelDistances = first.points.map( ( point, index ) => distance( point, reflected[ index ] ) );
  const parallelMax = Math.max( ...parallelDistances );

  const nearestDistances = first.points.map( ( point ) =>
    Math.min( ...reflected.map( ( other ) => distance( point, other ) ) ) );

  const parallelOrder = parallelMax <= Math.max( ...nearestDistances ) + 1e-9;
  const distances = parallelOrder ? parallelDistances : nearestDistances;

  return {
    maxMm: Math.max( ...distances ) * 1000,
    rmsMm: Math.sqrt( distances.reduce( ( total, value ) => total + value * value, 0 ) / distances.length ) * 1000,
    parallelOrder
  };

}

// --- 2. where each eye is, and which way it faces -------------------------------------------

/**
 * Object space, world space, and the forward axis.
 *
 * The forward axis is measured three independent ways rather than assumed, because the whole
 * refraction step is expressed in it:
 *
 *   - the SHAPE axis — the residual-weighted direction of the sphere-fit bulge. This is the one
 *     HDRP means. It is only trustworthy if the residual in §3 is large enough to be signal.
 *   - the OPENING axis — the eyeball is an open cap, so the direction away from the hole in the
 *     back is the anatomical forward regardless of whether there is a bulge.
 *   - the CAP axis — the mean direction of the vertices, which for an open cap points forward too.
 *
 * Three agreeing weak measurements beat one strong assumption. Where they disagree, the report
 * says so instead of picking a favourite.
 */
function reportPlacementAndFacing( eyeMesh, eyes ) {

  heading( '2. placement and facing' );

  eyeMesh.updateWorldMatrix( true, false );
  const worldElements = eyeMesh.matrixWorld.elements;
  const isIdentityWorld = worldElements.every( ( value, index ) =>
    Math.abs( value - ( index % 5 === 0 ? 1 : 0 ) ) < 1e-9 );

  row( 'mesh.matrixWorld', isIdentityWorld ? 'IDENTITY' : worldElements.map( format4 ).join( ' ' ) );
  row( 'mesh.bindMatrix', eyeMesh.bindMatrix.elements.every( ( value, index ) =>
    Math.abs( value - ( index % 5 === 0 ? 1 : 0 ) ) < 1e-9 ) ? 'IDENTITY' : 'non-identity' );
  row( 'skin bones', describeSkinBinding( eyeMesh ) );
  console.log();
  console.log( '  With an identity world matrix and an identity bind matrix, OBJECT SPACE AND WORLD' );
  console.log( '  SPACE ARE THE SAME SPACE for this mesh, and neither is eye-local — the eye centre' );
  console.log( '  sits at head height, not at the origin. Every number below is in that one frame.' );

  console.log();
  table(
    [ 'eye', 'centroid x (m)', 'centroid y (m)', 'centroid z (m)', 'sphere centre x/y/z (m)' ],
    eyes.map( ( eye ) => [
      eye.label,
      format4( eye.centroid[ 0 ] ), format4( eye.centroid[ 1 ] ), format4( eye.centroid[ 2 ] ),
      eye.sphere.centre.map( format4 ).join( '  ' )
    ] )
  );

  console.log();
  table(
    [ 'eye', 'shape axis', 'opening axis', 'cap axis', 'shape vs +Z', 'opening vs +Z', 'cap vs +Z' ],
    eyes.map( ( eye ) => [
      eye.label,
      eye.shapeAxis.map( format3 ).join( ' ' ),
      eye.openingAxis.map( format3 ).join( ' ' ),
      eye.capAxis.map( format3 ).join( ' ' ),
      `${ angleBetweenDegrees( eye.shapeAxis, [ 0, 0, 1 ] ).toFixed( 1 ) }°`,
      `${ angleBetweenDegrees( eye.openingAxis, [ 0, 0, 1 ] ).toFixed( 1 ) }°`,
      `${ angleBetweenDegrees( eye.capAxis, [ 0, 0, 1 ] ).toFixed( 1 ) }°`
    ] )
  );

  console.log();
  console.log( '  The shape axis is only meaningful if §3 shows a residual well above tessellation' );
  console.log( '  noise. Read §3 before trusting that column.' );

}

// --- 3. sphere or corneal dome — THE measurement --------------------------------------------

/**
 * The question item 3.3 lives or dies on.
 *
 * The sphere is fitted algebraically (minimise |v|² − 2c·v − k, which is linear in c and k and
 * therefore has a closed form) rather than iteratively, because a 48-vertex cloud gives an
 * iterative fit nothing to converge on that the closed form does not already have.
 *
 * Then the radius is binned by angle from the forward axis. The interpretation is the whole point:
 * an eye with a cornea shows radius CLIMBING as the angle goes to zero, by a millimetre or more
 * over the last 20°. A sphere shows a flat line inside the tessellation noise. There is no
 * ambiguous middle case at the millimetre scale a 12 mm eyeball works at.
 */
function reportShape( eyes, globeEyes, hasCornea ) {

  heading( '3. sphere or corneal dome  ← the deciding measurement' );

  table(
    [ 'eye', 'fitted R (mm)', 'residual RMS (mm)', 'residual max (mm)', 'RMS as % of R' ],
    eyes.map( ( eye ) => [
      eye.label,
      ( eye.sphere.radius * 1000 ).toFixed( 3 ),
      ( eye.sphere.residualRms * 1000 ).toFixed( 3 ),
      ( eye.sphere.residualMaxAbs * 1000 ).toFixed( 3 ),
      ( eye.sphere.residualRms / eye.sphere.radius * 100 ).toFixed( 2 )
    ] )
  );

  for ( const eye of eyes ) {

    console.log();
    console.log( `  ${ eye.label } — radius as a function of angle from the forward axis (+Z)` );
    console.log( `  A cornea would show the top rows climbing above the rest by ~1 mm or more.` );
    console.log();

    table(
      [ 'angle from +Z', 'n', 'mean R (mm)', 'min R (mm)', 'max R (mm)', 'mean − fitted R (mm)' ],
      eye.radiusByAngle.map( ( bin ) => [
        `${ String( bin.fromDegrees ).padStart( 3 ) }–${ String( bin.toDegrees ).padStart( 3 ) }°`,
        String( bin.count ),
        bin.count === 0 ? '—' : ( bin.meanRadius * 1000 ).toFixed( 3 ),
        bin.count === 0 ? '—' : ( bin.minRadius * 1000 ).toFixed( 3 ),
        bin.count === 0 ? '—' : ( bin.maxRadius * 1000 ).toFixed( 3 ),
        bin.count === 0 ? '—' : ( ( bin.meanRadius - eye.sphere.radius ) * 1000 ).toFixed( 3 )
      ] )
    );

    const front = eye.radiusByAngle[ 0 ];
    const equator = eye.radiusByAngle.find( ( bin ) => bin.fromDegrees === 75 || bin.fromDegrees === 90 );

    if ( front.count > 0 && equator !== undefined && equator.count > 0 ) {
      const bulgeMm = ( front.meanRadius - equator.meanRadius ) * 1000;
      console.log();
      row( 'front bin minus equator bin', `${ bulgeMm.toFixed( 3 ) } mm` );
      row( 'whole-shell sphere-fit residual RMS', `${ ( eye.sphere.residualRms * 1000 ).toFixed( 3 ) } mm` );
      row( 'that comparison says', Math.abs( bulgeMm ) > 3 * eye.sphere.residualRms * 1000
        ? 'a bulge above the noise'
        : 'no bulge — and see below, because this form of the test cannot tell' );
    }

    // The same question asked with an instrument that works on a domed shell. The version above
    // compares the bulge against the residual of a sphere fitted to the WHOLE shell, and on a shell
    // that is deliberately two radii the dome is most of that residual — so it is compared against
    // itself and buried. Fitting the reference sphere to the sclera alone, where there is no cornea
    // by construction, gives a noise estimate that is actually noise. See
    // tools/figure-pipeline/cornea_geometry.mjs, and its selftest for the both-directions check.
    const dome = measureCornealDome( eye.points );

    console.log();
    if ( dome.measured === false ) {
      row( 'posterior-band instrument', `NOT MEASURED — ${ dome.frontCapCount } vertices in the ` +
        `front cap and ${ dome.posteriorCount } behind ${ POSTERIOR_BAND_MIN_DEGREES }°` );
    } else {
      row( `reference sphere fitted beyond ${ POSTERIOR_BAND_MIN_DEGREES }°`,
        `R ${ dome.posteriorRadiusMm.toFixed( 3 ) } mm over ${ dome.posteriorCount } verts, ` +
        `RMS ${ dome.noiseMm.toFixed( 3 ) } mm` );
      row( `front ${ FRONT_CAP_DEGREES }° cap against that sphere`,
        `mean ${ dome.meanProudMm.toFixed( 3 ) } mm proud, max ${ dome.maxProudMm.toFixed( 3 ) } mm, ` +
        `over ${ dome.frontCapCount } verts` );
      row( 'verdict', dome.hasDome
        ? `A CORNEAL DOME — ${ dome.domeRatio.toFixed( 2 ) }x the fit noise, threshold ${ DOME_NOISE_MULTIPLE }x`
        : `NO CORNEAL DOME — ${ dome.domeRatio.toFixed( 2 ) }x the fit noise, threshold ${ DOME_NOISE_MULTIPLE }x` );
    }

  }

  if ( hasCornea === true ) {

    console.log();
    console.log( '  The anterior chamber — how far the corneal apex stands in front of the globe\'s.' );
    console.log( '  This is the gap a refracted ray crosses, and it needs no fit and no threshold:' );
    console.log( '  either there are two surfaces or there is one.' );
    console.log();

    table(
      [ 'eye', 'anterior chamber (mm)' ],
      eyes.map( ( eye, index ) => [
        eye.label,
        measureAnteriorChamberMm( eye.points, globeEyes[ index ].points ).toFixed( 3 )
      ] )
    );

  }

  console.log();
  console.log( '  Also worth reading off the table: where the bins run out. An open cap that stops' );
  console.log( '  short of 180° is a partial sphere with a hole in the back, which is what a mesh' );
  console.log( '  hidden inside a skull normally is.' );

  console.log();
  console.log( '  The apex, close up. A cornea is a bulge AT THE POLE, so if the mesh has no vertex' );
  console.log( '  near the pole there is nowhere for a bulge to be, and the frontmost surface is a' );
  console.log( '  flat facet sitting INSIDE the sphere by the sagitta below — the opposite of a dome.' );
  console.log();

  table(
    [ 'eye', 'nearest vertex to +Z', 'facet verts', 'apex plane RMS (mm)',
      'sphere sagitta over the facet (mm)', 'apex facet is' ],
    eyes.map( ( eye ) => [
      eye.label,
      `${ eye.apex.nearestDegrees.toFixed( 1 ) }°`,
      String( eye.apex.vertexCount ),
      eye.apex.planeRmsMm.toFixed( 4 ),
      eye.apex.sagittaMm.toFixed( 4 ),
      eye.apex.sagittaMm > 0 ? 'FLAT, recessed below the sphere' : 'n/a'
    ] )
  );

  // The positions are a coarse cage, but the SHADING normal is what a refraction step actually
  // reads, and the two can disagree. Worth its own row, because a smooth normal field over a
  // faceted cage is a very different starting point from a faceted normal field.
  console.log();
  console.log( '  Shipped vertex normals against the fitted sphere\'s own radial direction. The' );
  console.log( '  refraction step reads the SHADING normal, not the facet, so this decides whether' );
  console.log( '  the normal field is usable even where the positions are coarse.' );
  console.log();

  table(
    [ 'eye', 'region', 'n', 'median deviation', 'max deviation' ],
    eyes.flatMap( ( eye ) => [
      [ eye.label, 'front hemisphere (≤90°)', String( eye.normalDeviation.front.count ),
        `${ eye.normalDeviation.front.median.toFixed( 2 ) }°`,
        `${ eye.normalDeviation.front.max.toFixed( 2 ) }°` ],
      [ eye.label, 'whole cap', String( eye.normalDeviation.all.count ),
        `${ eye.normalDeviation.all.median.toFixed( 2 ) }°`,
        `${ eye.normalDeviation.all.max.toFixed( 2 ) }°` ]
    ] )
  );

}

// --- 4. UVs ----------------------------------------------------------------------------------

/**
 * The technique wants "sclera UV is literally the object-space XY", so the test is a linear
 * regression of u on (x, y) and of v on (x, y), and the answer is the R² of that fit.
 *
 * Restricted to the front hemisphere on purpose. Behind the equator a planar projection folds
 * back on itself — two rings at 63° and 117° share the same projected radius — so a UV layout
 * that is planar where it is *visible* will always look broken if the hidden back band is
 * included in the fit. Both fits are printed so the difference is visible rather than assumed.
 *
 * The correlation the brief asked for (UV distance from centre against object-space XY radius) is
 * printed alongside, since it is the cheap version of the same test.
 */
function reportUvs( eyes ) {

  heading( '4. UVs  — measured on the GLOBE, because that is where the sclera texture is' );

  if ( eyes[ 0 ].uv === null ) {
    console.log( '  NOT MEASURED: the geometry carries no uv attribute.' );
    return;
  }

  row( 'uv sets present', eyes[ 0 ].uvSetNames.join( ', ' ) );

  console.log();
  table(
    [ 'eye', 'u min', 'u max', 'v min', 'v max', 'u centre', 'v centre', 'uv radius max' ],
    eyes.map( ( eye ) => [
      eye.label,
      format4( eye.uvBounds.uMin ), format4( eye.uvBounds.uMax ),
      format4( eye.uvBounds.vMin ), format4( eye.uvBounds.vMax ),
      format4( eye.uvBounds.uCentre ), format4( eye.uvBounds.vCentre ),
      format4( eye.uvBounds.radiusMax )
    ] )
  );

  console.log();
  console.log( '  Planar-projection test — least squares u = a·x + b·y + c, v = d·x + e·y + f.' );
  console.log( '  R² near 1 means the UV IS the object-space XY up to an affine map, which is the' );
  console.log( '  contract §1 of the research doc states.' );
  console.log();

  table(
    [ 'eye', 'region', 'n', 'R² for u', 'R² for v', 'residual RMS (uv)', 'residual RMS (texels @1024)' ],
    eyes.flatMap( ( eye ) => [
      [ eye.label, 'front hemisphere (≤90°)', String( eye.planarFrontFit.count ),
        format4( eye.planarFrontFit.rSquaredU ), format4( eye.planarFrontFit.rSquaredV ),
        format4( eye.planarFrontFit.residualRms ),
        ( eye.planarFrontFit.residualRms * 1024 ).toFixed( 2 ) ],
      [ eye.label, 'whole cap', String( eye.planarAllFit.count ),
        format4( eye.planarAllFit.rSquaredU ), format4( eye.planarAllFit.rSquaredV ),
        format4( eye.planarAllFit.residualRms ),
        ( eye.planarAllFit.residualRms * 1024 ).toFixed( 2 ) ]
    ] )
  );

  console.log();
  table(
    [ 'eye', 'Pearson r: uv radius vs object XY radius (≤90°)', 'same, whole cap',
      'Pearson r: u vs azimuth (equirect test)' ],
    eyes.map( ( eye ) => [
      eye.label,
      format4( eye.uvRadiusCorrelationFront ),
      format4( eye.uvRadiusCorrelationAll ),
      format4( eye.equirectCorrelation )
    ] )
  );

  console.log();
  console.log( '  The u-vs-azimuth column is the spherical/equirect alternative. A genuine equirect' );
  console.log( '  unwrap puts |r| near 1 there and low R² on the planar fit; a planar projection does' );
  console.log( '  the opposite. They cannot both be high.' );

  console.log();
  console.log( '  Implied planar scale, from the front-hemisphere fit — the object-space extent that' );
  console.log( '  one full UV unit spans, which is what an eye-local remap has to divide by:' );
  console.log();
  table(
    [ 'eye', 'du/dx (per m)', 'du/dy', 'dv/dx', 'dv/dy (per m)', 'metres per uv unit (x)', '(y)' ],
    eyes.map( ( eye ) => [
      eye.label,
      eye.planarFrontFit.u[ 0 ].toFixed( 2 ), eye.planarFrontFit.u[ 1 ].toFixed( 2 ),
      eye.planarFrontFit.v[ 0 ].toFixed( 2 ), eye.planarFrontFit.v[ 1 ].toFixed( 2 ),
      ( 1 / eye.planarFrontFit.u[ 0 ] ).toFixed( 5 ),
      ( 1 / eye.planarFrontFit.v[ 1 ] ).toFixed( 5 )
    ] )
  );

}

// --- 5. scale --------------------------------------------------------------------------------

function reportScale( scene, eyeMesh, eyes ) {

  heading( '5. scale' );

  const sceneBounds = new Box3().setFromObject( scene );
  const size = sceneBounds.getSize( new Vector3() );

  row( 'figure bounding box (m)', `${ format4( size.x ) } × ${ format4( size.y ) } × ${ format4( size.z ) }` );
  row( 'figure height (m)', format4( size.y ) );
  row( 'eye centre height (m)', format4( eyes[ 0 ].sphere.centre[ 1 ] ) );
  row( 'interpupillary distance (mm)', ( distance( eyes[ 0 ].sphere.centre, eyes[ 1 ].sphere.centre ) * 1000 ).toFixed( 2 ) );
  row( 'mesh scale from matrixWorld', new Vector3().setFromMatrixScale( eyeMesh.matrixWorld ).toArray().map( format4 ).join( ' ' ) );

  console.log();
  table(
    [ 'eye', 'fitted R (mm)', 'human reference (mm)', 'ratio to human', 'diameter (mm)' ],
    eyes.map( ( eye ) => [
      eye.label,
      ( eye.sphere.radius * 1000 ).toFixed( 2 ),
      HUMAN_EYEBALL_RADIUS_MM.toFixed( 1 ),
      ( eye.sphere.radius * 1000 / HUMAN_EYEBALL_RADIUS_MM ).toFixed( 3 ),
      ( eye.sphere.radius * 2000 ).toFixed( 2 )
    ] )
  );

  console.log();
  row( 'eye height as a fraction of stature', format4( eyes[ 0 ].sphere.centre[ 1 ] / size.y ) );
  console.log();
  console.log( '  A figure this tall, with the eyes at ~0.94 of its height and an IPD in the fifties' );
  console.log( '  of millimetres, is authored in real-world metres, not a normalised space. That' );
  console.log( '  cross-check matters: it means the radius above can be compared to human anatomy at' );
  console.log( '  face value, and the ratio column is a real discrepancy rather than a unit error.' );

}

// --- 6. material and textures ----------------------------------------------------------------

/**
 * Reads the eye's material through three.js, then goes back to the GLB container for the texture,
 * because the createImageBitmap stub at the top of this file hands three a 1×1 placeholder. The
 * PNG is decoded with the critic harness's own decoder rather than a new dependency.
 *
 * The measurement that matters for §5 of the research doc — "sclera map with no iris information,
 * iris map with no sclera information" — is whether the shipped map has BOTH baked into one image.
 * A coloured, dark disc inside an otherwise near-white square answers that directly, so the iris
 * is found by thresholding on saturation and luma and its extent reported in UV units.
 *
 * Returns the measured iris disc so §8 can express it as an HDRP-style constant, or null.
 */
function reportMaterialAndTextures( container, eyeMesh, globeMesh, eyes ) {

  heading( '6. material and textures' );

  const mapSlots = [ 'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap',
    'alphaMap', 'clearcoatMap', 'transmissionMap' ];

  // One report per distinct mesh: a single-shell figure has the globe AS the refracting surface.
  const shells = eyeMesh === globeMesh
    ? [ [ 'eyeball', globeMesh ] ]
    : [ [ 'refracting surface', eyeMesh ], [ 'globe', globeMesh ] ];

  for ( const [ label, mesh ] of shells ) {

    const shellMaterial = Array.isArray( mesh.material ) ? mesh.material[ 0 ] : mesh.material;

    console.log();
    row( `${ label } mesh`, mesh.name );
    row( 'material', `${ shellMaterial.name }  (${ shellMaterial.type })` );
    row( 'base colour factor', `#${ shellMaterial.color.getHexString() }` );
    row( 'roughness / metalness', `${ shellMaterial.roughness } / ${ shellMaterial.metalness }` );
    row( 'transmission / ior', `${ shellMaterial.transmission ?? '—' } / ${ shellMaterial.ior ?? '—' }` );
    row( 'alpha mode', `${ shellMaterial.transparent ? 'BLEND' : 'OPAQUE' }  alphaTest ${ shellMaterial.alphaTest }` );
    row( 'side', shellMaterial.side === 0 ? 'FrontSide' : String( shellMaterial.side ) );

    const present = mapSlots.filter( ( slot ) => shellMaterial[ slot ] != null );
    row( 'texture slots used', present.length === 0 ? 'none' : present.join( ', ' ) );

  }

  console.log();
  console.log( '  The iris lives on the globe, so everything below reads the globe\'s base-colour' );
  console.log( '  map and measures the globe\'s own UV squares.' );

  const material = Array.isArray( globeMesh.material ) ? globeMesh.material[ 0 ] : globeMesh.material;
  const image = findEyeImage( container, material );

  if ( image === null ) {
    console.log();
    console.log( '  NOT MEASURED: could not locate the base-colour image in the GLB container.' );
    return null;
  }

  console.log();
  row( 'base colour image', `${ image.name }  ${ image.mimeType }  ${ image.byteLength } bytes` );

  if ( image.mimeType !== 'image/png' ) {
    console.log( `  NOT MEASURED: only PNG is decoded here; this image is ${ image.mimeType }.` );
    return null;
  }

  const decoded = decodePng( Buffer.from( image.bytes ) );
  row( 'decoded', `${ decoded.width } × ${ decoded.height }  colour type ${ decoded.colorType }  ${ decoded.bitDepth }-bit` );

  const discs = eyes.map( ( eye ) => ( { eye, disc: measureIrisDisc( decoded, eye ) } ) );

  console.log();
  console.log( '  Iris detector — thresholds are relative to each square\'s own median, so the' );
  console.log( '  measurement does not depend on an assumption about how light the sclera is:' );
  console.log();

  table(
    [ 'eye', 'median sclera RGB', 'median luma', 'median saturation',
      'iris if saturation >', 'or luma <' ],
    discs.map( ( { eye, disc } ) => [
      eye.label,
      disc.medianRgb.map( ( channel ) => Math.round( channel * 255 ) ).join( ',' ),
      format4( disc.medianLuma ),
      format4( disc.medianSaturation ),
      format4( disc.medianSaturation + IRIS_SATURATION_MARGIN ),
      format4( disc.medianLuma * IRIS_LUMA_FRACTION )
    ] )
  );

  console.log();
  table(
    [ 'eye', 'texels in square', 'iris texels', 'iris fraction', 'iris centre (uv)',
      'iris R, equal-area (uv)', 'iris R, p98 (uv)', 'equal-area R / eye UV R' ],
    discs.map( ( { eye, disc } ) => [
      eye.label,
      String( disc.totalTexels ),
      String( disc.irisTexels ),
      `${ ( disc.irisTexels / disc.totalTexels * 100 ).toFixed( 1 ) }%`,
      `${ format4( disc.centreU ) }, ${ format4( disc.centreV ) }`,
      format4( disc.equalAreaRadius ),
      format4( disc.percentileRadius ),
      format4( disc.equalAreaRadius / eye.uvBounds.radiusMax )
    ] )
  );

  console.log();
  console.log( '  Offset of the detected iris centre from the eye\'s own UV centre — if the UV centre' );
  console.log( '  is the forward pole, these should be close to zero:' );
  console.log();
  table(
    [ 'eye', 'iris centre − uv centre (u)', '(v)', 'as a fraction of eye UV radius' ],
    discs.map( ( { eye, disc } ) => [
      eye.label,
      format4( disc.centreU - eye.uvBounds.uCentre ),
      format4( disc.centreV - eye.uvBounds.vCentre ),
      format4( Math.hypot( disc.centreU - eye.uvBounds.uCentre, disc.centreV - eye.uvBounds.vCentre )
        / eye.uvBounds.radiusMax )
    ] )
  );

  // The picture, not just the numbers. §5 of the research doc's authoring requirement is a
  // statement about what is in the image, and one printed square settles it faster than any
  // statistic: if a coloured disc and a sclera field are visible in the same square, they are
  // composited into one map and the requirement is not met.
  for ( const { eye, disc } of discs ) {
    console.log();
    console.log( `  ${ eye.label } — UV square of the base-colour map, ${ PREVIEW_CELLS } cells across` );
    console.log( '    "#" iris (saturated)   "@" pupil (dark)   "-" sclera   "+" darker sclera   " " transparent' );
    console.log();
    for ( const line of previewUvSquare( decoded, eye, disc ) ) console.log( `    ${ line }` );
  }

  console.log();
  console.log( '  A single map holding both a coloured iris disc and a sclera field is exactly the' );
  console.log( '  composited layout §5 of the research doc says not to author.' );

  return discs[ 0 ].disc;

}

// --- 7. eyeLook* morphs -----------------------------------------------------------------------

/**
 * Gaze is morph-driven on this rig — `docs/LEARNINGS.md` records that there are no eye bones — so
 * the eyeball geometry itself moves when the figure looks around. That breaks any shader that
 * treats object space as a static eye frame.
 *
 * The useful decomposition is rigid translation versus everything else. If a morph is a pure
 * translation of all 48 vertices, an eye-local frame can be recovered by tracking the centroid and
 * the shader survives. If the residual after removing the mean translation is comparable to the
 * translation itself, the morph is deforming the eyeball and no rigid frame exists at all.
 */
function reportMorphDisplacement( eyeMesh, eyes, corneaMesh, corneaEyes ) {

  heading( '7. eyeLook* morph displacement  — measured on the GLOBE' );

  const dictionary = eyeMesh.morphTargetDictionary;

  if ( dictionary === undefined ) {
    console.log( '  NOT MEASURED: the eyeball mesh carries no morph targets.' );
    return null;
  }

  row( 'morphs on this mesh', Object.keys( dictionary ).join( ', ' ) );
  row( 'morphTargetsRelative', String( eyeMesh.geometry.morphTargetsRelative ) );

  const deltas = eyeMesh.geometry.morphAttributes.position;
  const gaze = { maxRotationDegrees: 0, maxCentreShiftMm: 0, maxResidualFraction: 0 };

  for ( const eye of eyes ) {

    console.log();
    console.log( `  ${ eye.label } — displacement at morph weight 1.0` );
    console.log();

    const rows = [];

    for ( const [ name, index ] of Object.entries( dictionary ) ) {

      const measurement = measureMorphOnComponent( deltas[ index ], eye );
      const moves = measurement.peakMm > 0;

      if ( moves ) {
        gaze.maxRotationDegrees = Math.max( gaze.maxRotationDegrees, measurement.rotationDegrees );
        gaze.maxCentreShiftMm = Math.max( gaze.maxCentreShiftMm, measurement.sphereCentreShiftMm );
        gaze.maxResidualFraction = Math.max( gaze.maxResidualFraction,
          measurement.residualRmsMm / measurement.peakMm );
      }

      rows.push( [
        name,
        ( measurement.peakMm ).toFixed( 3 ),
        moves ? measurement.rotationDegrees.toFixed( 2 ) : '—',
        moves ? measurement.rotationAxis.map( format3 ).join( ' ' ) : '—',
        moves ? measurement.pivotOffsetMm.toFixed( 3 ) : '—',
        ( measurement.sphereCentreShiftMm ).toFixed( 3 ),
        ( measurement.sphereRadiusChangeMm ).toFixed( 3 ),
        ( measurement.residualRmsMm ).toFixed( 4 ),
        moves ? ( measurement.residualRmsMm / measurement.peakMm * 100 ).toFixed( 1 ) + '%' : '—'
      ] );

    }

    table(
      [ 'morph', 'peak vertex (mm)', 'rotation (°)', 'rotation axis', 'pivot off centre (mm)',
        'eye centre moves (mm)', 'radius change (mm)', 'residual after rigid fit (mm)',
        'residual / peak' ],
      rows
    );

  }

  // Do the two shells turn together? They are separate meshes carrying separate copies of the same
  // eight morphs, so nothing in the file forces them to agree — and if they disagree the globe
  // swims inside its own front surface, which is the sort of defect that only shows up in motion
  // and only at large gaze angles. Cheap to check, expensive to discover later.
  if ( corneaMesh !== null && corneaMesh !== undefined ) {

    const corneaDictionary = corneaMesh.morphTargetDictionary ?? {};
    const corneaDeltas = corneaMesh.geometry.morphAttributes.position;
    let worstDisagreementDegrees = 0;
    const missing = [];

    for ( const [ name, index ] of Object.entries( dictionary ) ) {

      if ( name in corneaDictionary === false ) { missing.push( name ); continue; }

      const onGlobe = measureMorphOnComponent( deltas[ index ], eyes[ 0 ] );
      const onCornea = measureMorphOnComponent(
        corneaDeltas[ corneaDictionary[ name ] ], corneaEyes[ 0 ] );

      // Only the four morphs that drive THIS eye. A morph the eye does not respond to has no
      // rotation, so its "axis" is whatever the rigid fit fell out at, and comparing two of those
      // measures nothing — it reads as a 90 degree disagreement every time.
      if ( onGlobe.peakMm === 0 && onCornea.peakMm === 0 ) continue;

      worstDisagreementDegrees = Math.max( worstDisagreementDegrees,
        angleBetweenDegrees( onGlobe.rotationAxis, onCornea.rotationAxis ),
        Math.abs( onGlobe.rotationDegrees - onCornea.rotationDegrees ) );

    }

    console.log();
    row( 'morphs the cornea is missing', missing.length === 0 ? 'none' : missing.join( ', ' ) );
    row( 'worst globe-vs-cornea disagreement', `${ worstDisagreementDegrees.toFixed( 3 ) }° — ` +
      ( worstDisagreementDegrees < 1
        ? 'the two shells turn as one body'
        : 'THE SHELLS DISAGREE; the globe would swim inside its own front surface' ) );

  }

  console.log();
  console.log( '  Read the last column first. A small "residual / peak" means the morph is a RIGID' );
  console.log( '  MOTION — the eyeball moves as one body, so an eye-local frame exists and can be' );
  console.log( '  reconstructed. A large one means the mesh is being deformed and there is no rigid' );
  console.log( '  eye frame to recover at all.' );
  console.log();
  console.log( '  Then read "eye centre moves". It is the sphere refitted to the morphed vertices, so' );
  console.log( '  it is independent of the rigid decomposition and it is the number a shader has to' );
  console.log( '  act on: a fixed eye centre is one uniform, a moving one has to be driven from the' );
  console.log( '  same weights that drive the morphs. The pivot column explains why it moves — a' );
  console.log( '  rotation about a pivot that far off centre displaces the globe by 2·d·sin(θ/2).' );
  console.log();
  console.log( '  This table also confirms §1\'s left/right labels independently of any handedness' );
  console.log( '  convention: only the *Left morphs move the +X island, and eyeLookInLeft moves it' );
  console.log( '  towards −X, which is the midline. +X is the figure\'s own left eye.' );

  return gaze;

}

// --- 8. what the HDRP constants become -------------------------------------------------------

function reportDerivedConstants( eyes, irisDisc ) {

  heading( '8. the HDRP constants, converted into our units' );

  const eye = eyes[ 0 ];
  const radiusMm = eye.sphere.radius * 1000;

  console.log( '  HDRP works in a space where the eye XY half-extent is 0.5. Ours is the sphere' );
  console.log( `  radius, ${ radiusMm.toFixed( 2 ) } mm, so one HDRP unit is ${ ( radiusMm / HDRP.xyHalfExtent ).toFixed( 2 ) } mm here.` );
  console.log();

  const metresPerHdrpUnit = eye.sphere.radius / HDRP.xyHalfExtent;

  table(
    [ 'HDRP constant', 'HDRP value', 'in metres here', 'in mm here', 'note' ],
    [
      [ 'IRIS_RADIUS', HDRP.irisRadius.toFixed( 4 ),
        format4( HDRP.irisRadius * metresPerHdrpUnit ),
        ( HDRP.irisRadius * metresPerHdrpUnit * 1000 ).toFixed( 2 ),
        'geometric iris half-width' ],
      [ 'IRIS_PLANE_OFFSET', HDRP.irisPlaneOffset.toFixed( 4 ),
        format4( HDRP.irisPlaneOffset * metresPerHdrpUnit ),
        ( HDRP.irisPlaneOffset * metresPerHdrpUnit * 1000 ).toFixed( 2 ),
        'depth of the flat iris plane behind the origin' ],
      [ 'CORNEA_IOR', HDRP.corneaIor.toFixed( 4 ), 'dimensionless', 'dimensionless',
        'unchanged by scale' ]
    ]
  );

  if ( irisDisc !== null ) {
    console.log();
    row( 'iris radius measured in the shipped texture (uv)', format4( irisDisc.equalAreaRadius ) );
    row( 'as a fraction of the eye UV disc', format4( irisDisc.equalAreaRadius / eye.uvBounds.radiusMax ) );
    row( 'HDRP IRIS_RADIUS as the same fraction', format4( HDRP.irisRadius / HDRP.xyHalfExtent ) );
    console.log();
    console.log( '  These two fractions are directly comparable: both say "how much of the eye\'s' );
    console.log( '  projected disc is iris". A large gap means our texture\'s iris is not the size' );
    console.log( '  the HDRP constant assumes and the constant must be re-derived, not copied.' );
  }

  console.log();
  console.log( '  ⚠️  Every conversion above is arithmetic on the HDRP constants, NOT a measurement' );
  console.log( '      of our asset. They are what the constants would become IF the geometry' );
  console.log( '      satisfied the contract. §3 is what decides whether that "if" holds.' );

}

// --- 9. verdict --------------------------------------------------------------------------------

/**
 * The contract from §1 of the research doc, clause by clause, each one answered by a measurement
 * taken above rather than by a sentence written here. The thresholds are stated in the row itself
 * so a reader can disagree with one without having to re-derive the rest.
 */
function reportVerdict( eyes, globeEyes, hasCornea, irisDisc, gaze ) {

  // The planar-UV clause is a statement about the SCLERA's texture coordinates, and the sclera is
  // on the globe. The corneal shell carries no texture at all.
  const uvEye = globeEyes[ 0 ];

  heading( '9. verdict — does the asset satisfy the geometry contract' );

  const eye = eyes[ 0 ];
  const dome = measureCornealDome( eye.points );
  const chamberMm = hasCornea ? measureAnteriorChamberMm( eye.points, globeEyes[ 0 ].points ) : 0;
  const irisFraction = irisDisc === null ? null : irisDisc.irisTexels / irisDisc.totalTexels;

  const clauses = [
    [ 'one eye per object', eyes.islandCount === 1,
      `${ eyes.islandCount } islands share one buffer, one material, one draw range` ],
    [ 'eye centred on its own origin', Math.hypot( ...eye.sphere.centre ) < 0.01,
      `centre is ${ ( Math.hypot( ...eye.sphere.centre ) * 1000 ).toFixed( 0 ) } mm from the origin` ],
    [ 'cornea faces +Z', angleBetweenDegrees( eye.capAxis, [ 0, 0, 1 ] ) < 10,
      `cap axis is ${ angleBetweenDegrees( eye.capAxis, [ 0, 0, 1 ] ).toFixed( 1 ) }° off +Z` ],
    [ 'XY roughly in [-0.5, 0.5]', eye.sphere.radius > 0.2 && eye.sphere.radius < 1.0,
      `radius is ${ ( eye.sphere.radius * 1000 ).toFixed( 2 ) } mm — real metres, not normalised` ],
    [ 'a corneal dome, not a sphere', dome.measured === true && dome.hasDome === true,
      dome.measured === false ? 'not measurable' :
        `the front ${ FRONT_CAP_DEGREES }° cap sits ${ dome.meanProudMm.toFixed( 3 ) } mm proud of a ` +
        `sphere fitted to the sclera (RMS ${ dome.noiseMm.toFixed( 3 ) } mm), ` +
        `${ dome.domeRatio.toFixed( 2 ) }x noise against a ${ DOME_NOISE_MULTIPLE }x threshold` +
        ( hasCornea ? `; anterior chamber ${ chamberMm.toFixed( 3 ) } mm` : '' ) ],
    [ 'planar UV along the cornea axis', uvEye.planarFrontFit.rSquaredU > 0.99 && uvEye.planarFrontFit.rSquaredV > 0.99,
      `R² ${ format4( uvEye.planarFrontFit.rSquaredU ) } / ${ format4( uvEye.planarFrontFit.rSquaredV ) } ` +
      `over the globe's front hemisphere` ],
    [ 'iris map separate from sclera map', irisFraction === null || irisFraction < 0.02,
      irisFraction === null ? 'not measured' :
        `one base-colour map, ${ ( irisFraction * 100 ).toFixed( 1 ) }% of each eye square is iris` ],
    [ 'static eye in object space', gaze === null || gaze.maxCentreShiftMm < 0.1,
      gaze === null ? 'not measured' :
        `gaze rotates the globe up to ${ gaze.maxRotationDegrees.toFixed( 1 ) }° and moves its centre ` +
        `up to ${ gaze.maxCentreShiftMm.toFixed( 2 ) } mm, rigidly (residual ` +
        `${ ( gaze.maxResidualFraction * 100 ).toFixed( 1 ) }% of peak)` ]
  ];

  table(
    [ 'clause from research doc §1', 'holds?', 'measured' ],
    clauses.map( ( [ name, holds, evidence ] ) => [ name, holds ? 'yes' : 'NO', evidence ] )
  );

  const failures = clauses.filter( ( [ , holds ] ) => holds === false ).length;

  console.log();
  console.log( `  ${ failures } of ${ clauses.length } clauses fail as shipped.` );
  console.log();
  console.log( '  The one that was never negotiable in a shader is the corneal dome, because a' );
  console.log( '  missing dome is a missing refracting surface and no amount of shader arithmetic' );
  console.log( '  conjures geometry that is not in the buffer. That is why the asset changed rather' );
  console.log( '  than the shader. Everything still failing on this list is a frame change, a' );
  console.log( '  constant, or a texture split — work a shader author or a texture author absorbs:' );
  console.log();
  console.log( '    - the eye is two islands in one buffer at head height in real metres, so the' );
  console.log( '      shader re-derives an eye-local frame from a uniform rather than reading' );
  console.log( '      object space directly. §5 gives the conversion.' );
  console.log( '    - the iris and the sclera share one composited map, so §5 of the research doc\'s' );
  console.log( '      per-property blend needs the map split, or the blend re-expressed against it.' );
  console.log( '    - gaze moves the globe, so the eye centre is an animated uniform, not a constant.' );
  console.log( '      §7 shows the motion is RIGID, which is what makes that possible at all.' );
  console.log();
  console.log( '  Written up in the spike\'s report, not here: this file measures, it does not decide.' );

  reportHowTheShaderAnsweredThem();

}

// --- 10. what the shader did about it ------------------------------------------------------------

/**
 * The five failing clauses, and where each one went.
 *
 * This section is not a measurement, and it is here anyway. A verdict table that says "5 of 8 fail"
 * and stops is read by the next person as five open problems, and four rounds later somebody
 * re-derives the same workarounds — or worse, decides the asset has to change again. Each row
 * points at the code that absorbed the clause and says which numbers it needed.
 *
 * `packages/core/src/material/EyeMaterial.js` is the file, and
 * `packages/core/src/material/EyeMaterial.selftest.mjs` is what keeps the numbers honest.
 */
function reportHowTheShaderAnsweredThem() {

  heading( '10. what punch-list 3.3 did about the five failing clauses' );

  table(
    [ 'clause', 'blocks 3.3?', 'where it went' ],
    [
      [ 'one eye per object', 'no',
        'the shader splits the two eyes on the sign of the BIND-space x and carries every ' +
        'per-eye constant twice, mixing on that flag. Bind space, not animated space, so the ' +
        'flag is a compile-time constant per vertex.' ],
      [ 'eye centred on its own origin', 'no',
        'an eye-local frame is fitted at load — origin at the globe\'s sclera-band sphere centre, ' +
        '+z along the measured cornea axis — and every optical step happens in it.' ],
      [ 'XY roughly in [-0.5, 0.5]', 'no',
        'same fix. HDRP\'s normalised constants are re-derived in metres from this asset rather ' +
        'than copied: IRIS_RADIUS becomes 6.35 mm, measured, not 0.22 scaled.' ],
      [ 'iris map separate from sclera map', 'no, at a cost',
        'the one composited map is sampled TWICE, at the mesh UV for the sclera and at the ' +
        'refracted hit point for the iris. Costs nothing here because the iris disc is the middle ' +
        'of the square. What it DOES cost is research §5\'s per-property SSS blend, which needs ' +
        'two maps and stays out of scope.' ],
      [ 'static eye in object space', 'no',
        'ONE mat3 per eye per frame, recomposed from the eight eyeLook* weights and the head bone. ' +
        'Only possible because §7 measures the motion as rigid to 5.7% of peak.' ]
    ]
  );

  console.log();
  console.log( '  A SIXTH thing the shader needed, which is not on the contract and which this' );
  console.log( '  spike measured without anyone asking for it — §3\'s shipped-normals table.' );
  console.log( '  Median 3.53 degrees off the fitted sphere, maximum 23.51, over 256 vertices per' );
  console.log( '  eye. At the corneal shell\'s roughness a 3.5 degree normal error is a whole highlight' );
  console.log( '  width, and the first render put a hard-edged polygonal slab across each iris. Both' );
  console.log( '  shells are therefore shaded against ANALYTIC normals — the fitted anterior cap' );
  console.log( '  inside the cornea, the fitted eyeball outside it — which is a smoothing of the' );
  console.log( '  measured normal field rather than a different shape. That table was the evidence.' );

}

// --- measurement helpers ----------------------------------------------------------------------

async function loadScene( fileBytes ) {

  const buffer = fileBytes.buffer.slice( fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength );

  return new Promise( ( resolve, reject ) => {
    new GLTFLoader().parse( buffer, '', ( gltf ) => resolve( gltf.scene ), reject );
  } );

}

function findMesh( scene, pattern ) {

  let found = null;
  scene.traverse( ( object ) => {
    if ( object.isMesh === true && pattern.test( object.name ) ) found = object;
  } );
  return found;

}

/**
 * Splits one eye mesh into the figure's two eyes, and counts the connected islands on the way.
 *
 * Two things had to change here when the asset became two shells, and both are about the same
 * artifact: glTF stores one vertex per (position, uv) pair, so a vertex on a UV seam is written
 * twice. On the corneal shell that leaves 12 duplicate positions out of 524.
 *
 *   - The geometry is WELDED BY POSITION first. Duplicates are a texturing artifact, and left
 *     alone they add 22 phantom boundary edges, turn one boundary loop into six, drag the
 *     measured opening axis 85 degrees off true, and make the two eyes different vertex counts so
 *     the mirror check cannot run at all.
 *   - Islands are still counted and still reported in §1, because "are the two eyes separate
 *     geometry" was one of the questions this spike was written to answer. They no longer DEFINE
 *     an eye. Grouping on the sign of x instead reads a 58 mm interpupillary gap between two
 *     30 mm shells, which is not a guess about the layout — it is the widest gap in the file.
 */
function splitIntoEyes( mesh ) {

  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const index = geometry.index;

  // Welding. Positions come out of a float32 accessor, so equal positions are bit-equal and a
  // string key is exact — no epsilon, and therefore nothing that could weld two genuinely
  // different vertices together.
  const firstAtPosition = new Map();
  const canonicalOf = new Int32Array( position.count );
  for ( let vertex = 0; vertex < position.count; vertex ++ ) {
    const key = `${ position.getX( vertex ) },${ position.getY( vertex ) },${ position.getZ( vertex ) }`;
    if ( firstAtPosition.has( key ) === false ) firstAtPosition.set( key, vertex );
    canonicalOf[ vertex ] = firstAtPosition.get( key );
  }

  const parent = new Int32Array( position.count );
  for ( let vertex = 0; vertex < position.count; vertex ++ ) parent[ vertex ] = vertex;

  const find = ( vertex ) => {
    while ( parent[ vertex ] !== vertex ) {
      parent[ vertex ] = parent[ parent[ vertex ] ];
      vertex = parent[ vertex ];
    }
    return vertex;
  };

  const union = ( a, b ) => {
    a = find( a ); b = find( b );
    if ( a !== b ) parent[ b ] = a;
  };

  for ( let triangle = 0; triangle < index.count; triangle += 3 ) {
    const corners = [ 0, 1, 2 ].map( ( corner ) => canonicalOf[ index.getX( triangle + corner ) ] );
    union( corners[ 0 ], corners[ 1 ] );
    union( corners[ 1 ], corners[ 2 ] );
  }

  const groups = new Map();
  const canonicalVertices = [];
  for ( let vertex = 0; vertex < position.count; vertex ++ ) {
    if ( canonicalOf[ vertex ] !== vertex ) continue;
    canonicalVertices.push( vertex );
    const root = find( vertex );
    if ( groups.has( root ) === false ) groups.set( root, [] );
    groups.get( root ).push( vertex );
  }

  const islands = [ ...groups.values() ];

  // The figure's midline. Every eye mesh in this asset is symmetric about x = 0, so the mean is
  // the midline to within floating point.
  const meanX = canonicalVertices.reduce( ( total, vertex ) => total + position.getX( vertex ), 0 )
    / canonicalVertices.length;

  const sides = { left: [], right: [] };
  for ( const vertex of canonicalVertices ) {
    sides[ position.getX( vertex ) > meanX ? 'left' : 'right' ].push( vertex );
  }

  // Label by anatomy, from the figure's own frame: +X is the figure's left in a +Z-forward,
  // +Y-up right-handed rig, which is the VIEWER's right. Labelled as the figure's own sides.
  const eyes = [
    measureComponent( mesh, sides.left, new Set( sides.left ), canonicalOf ),
    measureComponent( mesh, sides.right, new Set( sides.right ), canonicalOf )
  ];
  eyes[ 0 ].label = 'left  (+X)';
  eyes[ 1 ].label = 'right (−X)';

  eyes.islandCount = islands.length;
  eyes.islandSizes = islands.map( ( island ) => island.length ).sort( ( a, b ) => b - a );
  eyes.duplicatePositionCount = position.count - canonicalVertices.length;

  return eyes;

}

function measureComponent( mesh, vertices, vertexSet, canonicalOf ) {

  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv ?? null;
  const index = geometry.index;

  const points = vertices.map( ( vertex ) => [
    position.getX( vertex ), position.getY( vertex ), position.getZ( vertex )
  ] );

  const centroid = [ 0, 1, 2 ].map( ( axis ) =>
    points.reduce( ( total, point ) => total + point[ axis ], 0 ) / points.length );

  // Triangles and boundary edges, on the WELDED topology. A UV seam is not a hole in the surface,
  // so counting it as one turns a closed cap's single boundary loop into several.
  let triangleCount = 0;
  const edgeUse = new Map();
  for ( let triangle = 0; triangle < index.count; triangle += 3 ) {
    const corners = [ 0, 1, 2 ].map( ( corner ) => canonicalOf[ index.getX( triangle + corner ) ] );
    if ( vertexSet.has( corners[ 0 ] ) === false ) continue;
    triangleCount ++;
    for ( let corner = 0; corner < 3; corner ++ ) {
      const a = corners[ corner ];
      const b = corners[ ( corner + 1 ) % 3 ];
      const key = a < b ? `${ a }_${ b }` : `${ b }_${ a }`;
      edgeUse.set( key, ( edgeUse.get( key ) ?? 0 ) + 1 );
    }
  }

  const boundaryEdges = [ ...edgeUse.entries() ].filter( ( [ , uses ] ) => uses === 1 );
  const boundaryEdgeCount = boundaryEdges.length;
  const boundaryLoopCount = countBoundaryLoops( boundaryEdges );

  const sphere = fitSphere( points );

  const component = {
    label: '',
    vertices,
    vertexSet,
    firstIndex: Math.min( ...vertices ),
    lastIndex: Math.max( ...vertices ),
    triangleCount,
    boundaryEdgeCount,
    boundaryLoopCount,
    points,
    centroid,
    sphere,
    uv,
    uvSetNames: Object.keys( geometry.attributes ).filter( ( name ) => name.startsWith( 'uv' ) )
  };

  component.shapeAxis = measureShapeAxis( component );
  component.openingAxis = measureOpeningAxis( component, boundaryEdges, position );
  component.capAxis = normalise( [ 0, 1, 2 ].map( ( axis ) => centroid[ axis ] - sphere.centre[ axis ] ) );

  // Everything downstream is expressed against +Z, because that is the convention the research doc
  // states and the thing under test is whether the asset honours it.
  component.radiusByAngle = binRadiusByAngle( component, [ 0, 0, 1 ] );
  component.apex = measureApex( component );
  component.normalDeviation = {
    front: measureNormalDeviation( component, geometry.attributes.normal, 90 ),
    all: measureNormalDeviation( component, geometry.attributes.normal, 180 )
  };

  if ( uv !== null ) {
    component.uvBounds = measureUvBounds( component, uv );
    component.planarFrontFit = fitPlanarProjection( component, uv, 90 );
    component.planarAllFit = fitPlanarProjection( component, uv, 180 );
    component.uvRadiusCorrelationFront = correlateUvRadius( component, uv, 90 );
    component.uvRadiusCorrelationAll = correlateUvRadius( component, uv, 180 );
    component.equirectCorrelation = correlateEquirect( component, uv );
  } else {
    component.uvBounds = null;
  }

  return component;

}

/**
 * Algebraic least-squares sphere. Writing |v − c|² = R² as |v|² = 2c·v + (R² − |c|²) makes the
 * problem linear in (c, k), so a 4×4 normal-equation solve gives the exact minimiser of the
 * algebraic residual in one step.
 */
function fitSphere( points ) {

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
  const residualRms = Math.sqrt( residuals.reduce( ( total, value ) => total + value * value, 0 ) / residuals.length );

  return {
    centre,
    radius,
    residuals,
    residualRms,
    residualMaxAbs: Math.max( ...residuals.map( Math.abs ) )
  };

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
 * The frontmost 20° of the mesh, examined on its own.
 *
 * Two numbers come out. The plane RMS says how flat the innermost vertices are — a dome would have
 * them curving away from any plane by hundreds of microns. The sagitta says how much surface a flat
 * facet spanning the same angular radius is MISSING relative to the fitted sphere, R·(1 − cos θ) for
 * the angle of the nearest vertex to the pole. On an eye with no vertex at the pole at all, the
 * sagitta is the depth of the dimple where the cornea should be.
 */
function measureApex( component ) {

  const nearestDegrees = Math.min( ...selectByAngle( component, 180 ).map( ( entry ) => entry.degrees ) );

  // The facet is the innermost ring. Its extent is taken as a multiple of the nearest-vertex angle
  // rather than a fixed number of degrees, so the selection follows the tessellation instead of
  // assuming it; 2.2× lands on the first ring and stops short of the second on this mesh.
  const selected = selectByAngle( component, nearestDegrees * 2.2 );

  if ( selected.length < 3 ) {
    return { nearestDegrees, vertexCount: selected.length, planeRmsMm: NaN, sagittaMm: NaN };
  }

  // Plane through the selected vertices: least squares z = a·x + b·y + c, which is well conditioned
  // here because the facet is nearly perpendicular to the z axis by construction.
  const design = selected.map( ( entry ) => [ entry.point[ 0 ], entry.point[ 1 ], 1 ] );
  const targets = selected.map( ( entry ) => entry.point[ 2 ] );
  const plane = solveLeastSquares( design, targets );

  const deviations = design.map( ( row, index ) =>
    targets[ index ] - ( row[ 0 ] * plane[ 0 ] + row[ 1 ] * plane[ 1 ] + row[ 2 ] * plane[ 2 ] ) );

  return {
    nearestDegrees,
    vertexCount: selected.length,
    planeRmsMm: Math.sqrt( deviations.reduce( ( total, value ) => total + value * value, 0 ) / deviations.length ) * 1000,
    sagittaMm: component.sphere.radius * ( 1 - Math.cos( nearestDegrees * Math.PI / 180 ) ) * 1000
  };

}

/** How far the shipped vertex normals sit from the fitted sphere's radial direction, in degrees. */
function measureNormalDeviation( component, normalAttribute, maxDegrees ) {

  const deviations = selectByAngle( component, maxDegrees ).map( ( entry ) => {

    const radial = normalise( [ 0, 1, 2 ].map( ( axis ) => entry.point[ axis ] - component.sphere.centre[ axis ] ) );
    const normal = normalise( [
      normalAttribute.getX( entry.vertex ),
      normalAttribute.getY( entry.vertex ),
      normalAttribute.getZ( entry.vertex )
    ] );

    return angleBetweenDegrees( radial, normal );

  } );

  return {
    count: deviations.length,
    median: median( deviations ),
    max: Math.max( ...deviations )
  };

}

/** The direction the sphere fit bulges in — the HDRP cornea axis, if there is a cornea. */
function measureShapeAxis( component ) {

  const axis = [ 0, 0, 0 ];

  component.points.forEach( ( point, index ) => {
    const residual = component.sphere.residuals[ index ];
    if ( residual <= 0 ) return;
    const direction = normalise( [ 0, 1, 2 ].map( ( a ) => point[ a ] - component.sphere.centre[ a ] ) );
    for ( let a = 0; a < 3; a ++ ) axis[ a ] += residual * direction[ a ];
  } );

  return normalise( axis );

}

/** The direction away from the hole in the back of the cap — anatomical forward, bulge or no bulge. */
function measureOpeningAxis( component, boundaryEdges, position ) {

  if ( boundaryEdges.length === 0 ) return [ 0, 0, 0 ];

  const seen = new Set();
  const opening = [ 0, 0, 0 ];

  for ( const [ key ] of boundaryEdges ) {
    for ( const vertex of key.split( '_' ).map( Number ) ) {
      if ( seen.has( vertex ) ) continue;
      seen.add( vertex );
      opening[ 0 ] += position.getX( vertex );
      opening[ 1 ] += position.getY( vertex );
      opening[ 2 ] += position.getZ( vertex );
    }
  }

  for ( let a = 0; a < 3; a ++ ) opening[ a ] = opening[ a ] / seen.size - component.sphere.centre[ a ];

  return normalise( opening.map( ( value ) => -value ) );

}

function countBoundaryLoops( boundaryEdges ) {

  const adjacency = new Map();
  for ( const [ key ] of boundaryEdges ) {
    const [ a, b ] = key.split( '_' ).map( Number );
    if ( adjacency.has( a ) === false ) adjacency.set( a, [] );
    if ( adjacency.has( b ) === false ) adjacency.set( b, [] );
    adjacency.get( a ).push( b );
    adjacency.get( b ).push( a );
  }

  const visited = new Set();
  let loops = 0;

  for ( const start of adjacency.keys() ) {
    if ( visited.has( start ) ) continue;
    loops ++;
    const stack = [ start ];
    while ( stack.length > 0 ) {
      const vertex = stack.pop();
      if ( visited.has( vertex ) ) continue;
      visited.add( vertex );
      for ( const next of adjacency.get( vertex ) ) if ( visited.has( next ) === false ) stack.push( next );
    }
  }

  return loops;

}

function binRadiusByAngle( component, axis ) {

  const binCount = Math.ceil( 180 / ANGLE_BIN_DEGREES );
  const bins = Array.from( { length: binCount }, ( _, index ) => ( {
    fromDegrees: index * ANGLE_BIN_DEGREES,
    toDegrees: ( index + 1 ) * ANGLE_BIN_DEGREES,
    radii: []
  } ) );

  for ( const point of component.points ) {
    const offset = [ 0, 1, 2 ].map( ( a ) => point[ a ] - component.sphere.centre[ a ] );
    const length = Math.hypot( ...offset );
    const cosine = ( offset[ 0 ] * axis[ 0 ] + offset[ 1 ] * axis[ 1 ] + offset[ 2 ] * axis[ 2 ] ) / length;
    const degrees = Math.acos( Math.max( -1, Math.min( 1, cosine ) ) ) * 180 / Math.PI;
    bins[ Math.min( binCount - 1, Math.floor( degrees / ANGLE_BIN_DEGREES ) ) ].radii.push( length );
  }

  return bins.map( ( bin ) => ( {
    fromDegrees: bin.fromDegrees,
    toDegrees: bin.toDegrees,
    count: bin.radii.length,
    meanRadius: bin.radii.length === 0 ? 0 : bin.radii.reduce( ( a, b ) => a + b, 0 ) / bin.radii.length,
    minRadius: bin.radii.length === 0 ? 0 : Math.min( ...bin.radii ),
    maxRadius: bin.radii.length === 0 ? 0 : Math.max( ...bin.radii )
  } ) );

}

function measureUvBounds( component, uv ) {

  const us = component.vertices.map( ( vertex ) => uv.getX( vertex ) );
  const vs = component.vertices.map( ( vertex ) => uv.getY( vertex ) );

  const uCentre = ( Math.min( ...us ) + Math.max( ...us ) ) / 2;
  const vCentre = ( Math.min( ...vs ) + Math.max( ...vs ) ) / 2;

  return {
    uMin: Math.min( ...us ), uMax: Math.max( ...us ),
    vMin: Math.min( ...vs ), vMax: Math.max( ...vs ),
    uCentre, vCentre,
    radiusMax: Math.max( ...us.map( ( u, index ) => Math.hypot( u - uCentre, vs[ index ] - vCentre ) ) )
  };

}

/** Least-squares u = a·x + b·y + c and v = d·x + e·y + f, restricted to vertices within `maxDegrees` of +Z. */
function fitPlanarProjection( component, uv, maxDegrees ) {

  const selected = selectByAngle( component, maxDegrees );

  const design = selected.map( ( entry ) => [ entry.point[ 0 ], entry.point[ 1 ], 1 ] );
  const uTargets = selected.map( ( entry ) => uv.getX( entry.vertex ) );
  const vTargets = selected.map( ( entry ) => uv.getY( entry.vertex ) );

  const u = solveLeastSquares( design, uTargets );
  const v = solveLeastSquares( design, vTargets );

  const uPredicted = design.map( ( row ) => row[ 0 ] * u[ 0 ] + row[ 1 ] * u[ 1 ] + row[ 2 ] * u[ 2 ] );
  const vPredicted = design.map( ( row ) => row[ 0 ] * v[ 0 ] + row[ 1 ] * v[ 1 ] + row[ 2 ] * v[ 2 ] );

  const squaredError = uTargets.reduce( ( total, target, index ) =>
    total + ( target - uPredicted[ index ] ) ** 2 + ( vTargets[ index ] - vPredicted[ index ] ) ** 2, 0 );

  return {
    count: selected.length,
    u, v,
    rSquaredU: rSquared( uTargets, uPredicted ),
    rSquaredV: rSquared( vTargets, vPredicted ),
    residualRms: Math.sqrt( squaredError / ( 2 * selected.length ) )
  };

}

function correlateUvRadius( component, uv, maxDegrees ) {

  const selected = selectByAngle( component, maxDegrees );
  const bounds = component.uvBounds;

  const objectRadius = selected.map( ( entry ) => Math.hypot(
    entry.point[ 0 ] - component.sphere.centre[ 0 ],
    entry.point[ 1 ] - component.sphere.centre[ 1 ] ) );

  const uvRadius = selected.map( ( entry ) => Math.hypot(
    uv.getX( entry.vertex ) - bounds.uCentre,
    uv.getY( entry.vertex ) - bounds.vCentre ) );

  return pearson( objectRadius, uvRadius );

}

/** The spherical/equirect alternative: u against azimuth about the forward axis. */
function correlateEquirect( component, uv ) {

  const azimuth = component.vertices.map( ( vertex, index ) => Math.atan2(
    component.points[ index ][ 1 ] - component.sphere.centre[ 1 ],
    component.points[ index ][ 0 ] - component.sphere.centre[ 0 ] ) );

  const us = component.vertices.map( ( vertex ) => uv.getX( vertex ) );

  return pearson( azimuth, us );

}

function selectByAngle( component, maxDegrees ) {

  const selected = [];

  component.vertices.forEach( ( vertex, index ) => {
    const point = component.points[ index ];
    const offset = [ 0, 1, 2 ].map( ( a ) => point[ a ] - component.sphere.centre[ a ] );
    const degrees = Math.acos( Math.max( -1, Math.min( 1, offset[ 2 ] / Math.hypot( ...offset ) ) ) ) * 180 / Math.PI;
    if ( degrees <= maxDegrees ) selected.push( { vertex, point, degrees } );
  } );

  return selected;

}

function solveLeastSquares( design, targets ) {

  const width = design[ 0 ].length;
  const normal = Array.from( { length: width }, () => new Array( width ).fill( 0 ) );
  const rightHandSide = new Array( width ).fill( 0 );

  design.forEach( ( row, index ) => {
    for ( let r = 0; r < width; r ++ ) {
      for ( let c = 0; c < width; c ++ ) normal[ r ][ c ] += row[ r ] * row[ c ];
      rightHandSide[ r ] += row[ r ] * targets[ index ];
    }
  } );

  return solveLinearSystem( normal, rightHandSide );

}

/**
 * What one morph does to one eyeball, decomposed into rotation, translation and deformation.
 *
 * The decomposition has to be a FULL rigid fit, not just a mean translation. An eyeball rotating in
 * its socket — which is precisely what gaze ought to be — moves every vertex by a different amount
 * in a different direction, so a translation-only decomposition scores it as heavy deformation and
 * reaches the wrong conclusion. Rotation is fine for a shader: it means an eye-local frame exists
 * and can be tracked. Genuine deformation is not, because then there is no frame at all.
 *
 * So the base and morphed vertex sets go through a Kabsch/Horn rigid fit and what is reported is
 * the residual AFTER the best rotation and translation have been removed.
 */
function measureMorphOnComponent( deltaAttribute, component ) {

  const displacements = component.vertices.map( ( vertex ) => [
    deltaAttribute.getX( vertex ), deltaAttribute.getY( vertex ), deltaAttribute.getZ( vertex )
  ] );

  const magnitudes = displacements.map( ( delta ) => Math.hypot( ...delta ) );
  const peakMm = Math.max( ...magnitudes ) * 1000;

  const morphed = component.points.map( ( point, index ) =>
    [ 0, 1, 2 ].map( ( axis ) => point[ axis ] + displacements[ index ][ axis ] ) );

  const rigid = fitRigidTransform( component.points, morphed );

  // The globe itself, refitted. Independent of the rigid decomposition and much easier to act on:
  // "how far does the eye centre move, and does the eyeball keep its size".
  const morphedSphere = fitSphere( morphed );
  const centreShift = [ 0, 1, 2 ].map( ( axis ) => morphedSphere.centre[ axis ] - component.sphere.centre[ axis ] );

  return {
    peakMm,
    sphereCentreShiftMm: Math.hypot( ...centreShift ) * 1000,
    sphereRadiusChangeMm: ( morphedSphere.radius - component.sphere.radius ) * 1000,
    meanMm: magnitudes.reduce( ( a, b ) => a + b, 0 ) / magnitudes.length * 1000,
    rotationDegrees: rigid.rotationDegrees,
    rotationAxis: rigid.rotationAxis,
    residualRmsMm: rigid.residualRms * 1000,
    pivotOffsetMm: measurePivotOffset( rigid, component ) * 1000
  };

}

/**
 * How far the motion's pivot sits from the fitted sphere centre.
 *
 * This is the number that decides whether the translation column means anything. A rotation about a
 * pivot away from the centroid necessarily moves the centroid, so a few millimetres of "translation"
 * can be nothing but a rotation seen from the wrong origin. If the pivot lands on the sphere centre,
 * the eyeball is doing exactly what an eyeball does — turning in place — and a shader can hold the
 * eye centre fixed and rotate its frame.
 *
 * A rigid motion x → R·(x − c) + c + 0 gives (I − R)·c = t, whose matrix is singular along the
 * rotation axis: how far along the axis the pivot sits is genuinely not determined by the motion.
 * So the axis component is pinned to the sphere centre's own, and what is reported is the part that
 * IS determined — the perpendicular offset.
 */
function measurePivotOffset( rigid, component ) {

  if ( rigid.rotationDegrees < 1e-6 ) return Math.hypot( ...rigid.translation );

  const axis = rigid.rotationAxis;
  const rotation = rigid.rotationMatrix;
  const centre = component.sphere.centre;

  // t as seen from the origin, for the fixed-point equation above.
  const rotatedFrom = rotation.map( ( row ) =>
    row[ 0 ] * rigid.centreFrom[ 0 ] + row[ 1 ] * rigid.centreFrom[ 1 ] + row[ 2 ] * rigid.centreFrom[ 2 ] );
  const offset = [ 0, 1, 2 ].map( ( index ) => rigid.centreTo[ index ] - rotatedFrom[ index ] );

  const a = [ 0, 1, 2 ].map( ( r ) => [ 0, 1, 2 ].map( ( c ) => ( r === c ? 1 : 0 ) - rotation[ r ][ c ] ) );

  const normal = [ 0, 1, 2 ].map( ( r ) => [ 0, 1, 2 ].map( ( c ) =>
    a[ 0 ][ r ] * a[ 0 ][ c ] + a[ 1 ][ r ] * a[ 1 ][ c ] + a[ 2 ][ r ] * a[ 2 ][ c ]
    + axis[ r ] * axis[ c ] ) );

  const axisDotCentre = axis[ 0 ] * centre[ 0 ] + axis[ 1 ] * centre[ 1 ] + axis[ 2 ] * centre[ 2 ];
  const rightHandSide = [ 0, 1, 2 ].map( ( r ) =>
    a[ 0 ][ r ] * offset[ 0 ] + a[ 1 ][ r ] * offset[ 1 ] + a[ 2 ][ r ] * offset[ 2 ]
    + axis[ r ] * axisDotCentre );

  const pivot = solveLinearSystem( normal, rightHandSide );
  const delta = [ 0, 1, 2 ].map( ( index ) => pivot[ index ] - centre[ index ] );
  const alongAxis = delta[ 0 ] * axis[ 0 ] + delta[ 1 ] * axis[ 1 ] + delta[ 2 ] * axis[ 2 ];

  return Math.hypot( ...[ 0, 1, 2 ].map( ( index ) => delta[ index ] - alongAxis * axis[ index ] ) );

}

/**
 * Kabsch via Horn's quaternion form: the optimal rotation is the eigenvector of a symmetric 4×4
 * belonging to its largest eigenvalue, which power iteration finds in a handful of steps once the
 * matrix is shifted positive-definite. Chosen over an SVD because a 4×4 power iteration is fifteen
 * readable lines and a 3×3 SVD is not.
 */
function fitRigidTransform( from, to ) {

  const count = from.length;
  const centreFrom = [ 0, 1, 2 ].map( ( axis ) => from.reduce( ( total, point ) => total + point[ axis ], 0 ) / count );
  const centreTo = [ 0, 1, 2 ].map( ( axis ) => to.reduce( ( total, point ) => total + point[ axis ], 0 ) / count );

  const p = from.map( ( point ) => [ 0, 1, 2 ].map( ( axis ) => point[ axis ] - centreFrom[ axis ] ) );
  const q = to.map( ( point ) => [ 0, 1, 2 ].map( ( axis ) => point[ axis ] - centreTo[ axis ] ) );

  const s = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ];
  for ( let index = 0; index < count; index ++ ) {
    for ( let r = 0; r < 3; r ++ ) for ( let c = 0; c < 3; c ++ ) s[ r ][ c ] += p[ index ][ r ] * q[ index ][ c ];
  }

  const trace = s[ 0 ][ 0 ] + s[ 1 ][ 1 ] + s[ 2 ][ 2 ];
  const horn = [
    [ trace, s[ 1 ][ 2 ] - s[ 2 ][ 1 ], s[ 2 ][ 0 ] - s[ 0 ][ 2 ], s[ 0 ][ 1 ] - s[ 1 ][ 0 ] ],
    [ s[ 1 ][ 2 ] - s[ 2 ][ 1 ], s[ 0 ][ 0 ] - s[ 1 ][ 1 ] - s[ 2 ][ 2 ], s[ 0 ][ 1 ] + s[ 1 ][ 0 ], s[ 2 ][ 0 ] + s[ 0 ][ 2 ] ],
    [ s[ 2 ][ 0 ] - s[ 0 ][ 2 ], s[ 0 ][ 1 ] + s[ 1 ][ 0 ], -s[ 0 ][ 0 ] + s[ 1 ][ 1 ] - s[ 2 ][ 2 ], s[ 1 ][ 2 ] + s[ 2 ][ 1 ] ],
    [ s[ 0 ][ 1 ] - s[ 1 ][ 0 ], s[ 2 ][ 0 ] + s[ 0 ][ 2 ], s[ 1 ][ 2 ] + s[ 2 ][ 1 ], -s[ 0 ][ 0 ] - s[ 1 ][ 1 ] + s[ 2 ][ 2 ] ]
  ];

  const quaternion = largestEigenvector( horn );
  const rotation = quaternionToMatrix( quaternion );

  const residuals = p.map( ( point, index ) => {
    const rotated = rotation.map( ( row ) => row[ 0 ] * point[ 0 ] + row[ 1 ] * point[ 1 ] + row[ 2 ] * point[ 2 ] );
    return Math.hypot( ...[ 0, 1, 2 ].map( ( axis ) => rotated[ axis ] - q[ index ][ axis ] ) );
  } );

  const angleRadians = 2 * Math.acos( Math.min( 1, Math.abs( quaternion[ 0 ] ) ) );
  const sine = Math.sqrt( Math.max( 0, 1 - quaternion[ 0 ] ** 2 ) );

  return {
    centreFrom,
    centreTo,
    rotationMatrix: rotation,
    translation: [ 0, 1, 2 ].map( ( axis ) => centreTo[ axis ] - centreFrom[ axis ] ),
    rotationDegrees: angleRadians * 180 / Math.PI,
    rotationAxis: sine < 1e-9 ? [ 0, 0, 0 ] : [ 1, 2, 3 ].map( ( index ) => quaternion[ index ] / sine ),
    residualRms: Math.sqrt( residuals.reduce( ( total, value ) => total + value * value, 0 ) / count )
  };

}

/** Power iteration on a symmetric 4×4, shifted by a Gershgorin bound so every eigenvalue is positive. */
function largestEigenvector( matrix ) {

  const shift = Math.max( ...matrix.map( ( row ) => row.reduce( ( total, value ) => total + Math.abs( value ), 0 ) ) );
  const shifted = matrix.map( ( row, r ) => row.map( ( value, c ) => value + ( r === c ? shift : 0 ) ) );

  let vector = [ 1, 0, 0, 0 ];

  for ( let step = 0; step < 200; step ++ ) {
    const next = shifted.map( ( row ) => row.reduce( ( total, value, index ) => total + value * vector[ index ], 0 ) );
    const length = Math.hypot( ...next );
    if ( length === 0 ) break;
    vector = next.map( ( value ) => value / length );
  }

  // A negative scalar part is the same rotation; normalising the sign keeps the reported angle in [0, 180].
  return vector[ 0 ] < 0 ? vector.map( ( value ) => -value ) : vector;

}

function quaternionToMatrix( [ w, x, y, z ] ) {
  return [
    [ 1 - 2 * ( y * y + z * z ), 2 * ( x * y - z * w ), 2 * ( x * z + y * w ) ],
    [ 2 * ( x * y + z * w ), 1 - 2 * ( x * x + z * z ), 2 * ( y * z - x * w ) ],
    [ 2 * ( x * z - y * w ), 2 * ( y * z + x * w ), 1 - 2 * ( x * x + y * y ) ]
  ];
}

// --- GLB container and texture ----------------------------------------------------------------

/** Splits a .glb into its JSON chunk and a view over its binary chunk, with no glTF library. */
function readGlbContainer( fileBuffer ) {

  const view = new DataView( fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength );

  if ( view.getUint32( 0, true ) !== GLB_MAGIC ) throw new Error( "Not a GLB: magic header is not 'glTF'." );

  const totalLength = view.getUint32( 8, true );

  let json = null;
  let binaryOffset = 0;
  let offset = 12;

  while ( offset < totalLength ) {
    const chunkLength = view.getUint32( offset, true );
    const chunkType = view.getUint32( offset + 4, true );
    const chunkStart = offset + 8;

    if ( chunkType === CHUNK_TYPE_JSON ) {
      json = JSON.parse( new TextDecoder().decode(
        new Uint8Array( fileBuffer.buffer, fileBuffer.byteOffset + chunkStart, chunkLength ) ) );
    } else if ( chunkType === CHUNK_TYPE_BIN ) {
      binaryOffset = fileBuffer.byteOffset + chunkStart;
    }

    offset = chunkStart + chunkLength;
  }

  if ( json === null ) throw new Error( 'GLB has no JSON chunk.' );

  return { json, binaryOffset, fileBuffer };

}

/** Finds the base-colour image bytes for the eye material by name, straight out of the container. */
function findEyeImage( container, material ) {

  const json = container.json;
  const gltfMaterial = ( json.materials ?? [] ).find( ( entry ) => entry.name === material.name );
  const textureIndex = gltfMaterial?.pbrMetallicRoughness?.baseColorTexture?.index;
  if ( textureIndex === undefined ) return null;

  const image = json.images[ json.textures[ textureIndex ].source ];
  const bufferView = json.bufferViews[ image.bufferView ];

  return {
    name: image.name,
    mimeType: image.mimeType,
    byteLength: bufferView.byteLength,
    bytes: new Uint8Array( container.fileBuffer.buffer,
      container.binaryOffset + ( bufferView.byteOffset ?? 0 ), bufferView.byteLength )
  };

}

/**
 * Finds the coloured iris disc inside one eye's UV square.
 *
 * Two passes. The first reads the square's median colour, luma and saturation — the sclera, since
 * it is the majority of the square — and the thresholds are set from those. The second classifies
 * and accumulates.
 *
 * Two radii are reported because they fail in different directions and disagreeing is informative.
 * The EQUAL-AREA radius is √(iris texels / π), which cannot be moved by a handful of stray texels
 * anywhere in the square but does assume the iris region is roughly a disc. The P98 radius is the
 * 98th percentile of texel distance from the iris centroid, which makes no shape assumption but
 * will over-read if the eyelid margin or a corner gradient trips the threshold. Close agreement
 * means the detector found one compact disc and nothing else.
 */
function measureIrisDisc( decoded, eye ) {

  const bounds = eye.uvBounds;
  const width = decoded.width;
  const height = decoded.height;

  const xMin = Math.max( 0, Math.floor( bounds.uMin * width ) );
  const xMax = Math.min( width - 1, Math.ceil( bounds.uMax * width ) );
  // glTF UV origin is top-left, PNG rows run top-down: v maps straight to the row index.
  const yMin = Math.max( 0, Math.floor( bounds.vMin * height ) );
  const yMax = Math.min( height - 1, Math.ceil( bounds.vMax * height ) );

  const samples = [];

  for ( let y = yMin; y <= yMax; y ++ ) {
    for ( let x = xMin; x <= xMax; x ++ ) {
      const sample = readTexel( decoded, x, y );
      if ( sample !== null ) samples.push( { x, y, ...sample } );
    }
  }

  if ( samples.length === 0 ) {
    return { totalTexels: 0, irisTexels: 0, centreU: bounds.uCentre, centreV: bounds.vCentre,
      equalAreaRadius: 0, percentileRadius: 0, medianRgb: [ 0, 0, 0 ], medianLuma: 0,
      medianSaturation: 0 };
  }

  const medianLuma = median( samples.map( ( sample ) => sample.luma ) );
  const medianSaturation = median( samples.map( ( sample ) => sample.saturation ) );
  const medianRgb = [ 0, 1, 2 ].map( ( channel ) => median( samples.map( ( sample ) => sample.rgb[ channel ] ) ) );

  const saturationThreshold = medianSaturation + IRIS_SATURATION_MARGIN;
  const lumaThreshold = medianLuma * IRIS_LUMA_FRACTION;

  const irisPoints = [];
  let sumU = 0;
  let sumV = 0;

  for ( const sample of samples ) {
    if ( sample.saturation <= saturationThreshold && sample.luma >= lumaThreshold ) continue;
    const u = ( sample.x + 0.5 ) / width;
    const v = ( sample.y + 0.5 ) / height;
    sumU += u; sumV += v;
    irisPoints.push( [ u, v ] );
  }

  const irisTexels = irisPoints.length;
  const centreU = irisTexels === 0 ? bounds.uCentre : sumU / irisTexels;
  const centreV = irisTexels === 0 ? bounds.vCentre : sumV / irisTexels;

  const distances = irisPoints
    .map( ( [ u, v ] ) => Math.hypot( u - centreU, v - centreV ) )
    .sort( ( a, b ) => a - b );

  // The texel grid is square in UV, so an area of N texels covers N / (width·height) of UV space.
  const equalAreaRadius = Math.sqrt( irisTexels / ( width * height ) / Math.PI );

  return {
    totalTexels: samples.length,
    irisTexels,
    centreU,
    centreV,
    equalAreaRadius,
    percentileRadius: distances.length === 0 ? 0 : distances[ Math.floor( distances.length * 0.98 ) ],
    medianRgb,
    medianLuma,
    medianSaturation,
    saturationThreshold,
    lumaThreshold
  };

}

/** Reads one texel as { rgb, luma, saturation }, or null where the map is transparent. */
function readTexel( decoded, x, y ) {

  const base = ( y * decoded.width + x ) * 4;
  if ( decoded.pixels[ base + 3 ] < 0.5 ) return null;

  const rgb = [ decoded.pixels[ base ], decoded.pixels[ base + 1 ], decoded.pixels[ base + 2 ] ];
  const maximum = Math.max( ...rgb );
  const minimum = Math.min( ...rgb );

  return {
    rgb,
    luma: 0.2126 * rgb[ 0 ] + 0.7152 * rgb[ 1 ] + 0.0722 * rgb[ 2 ],
    saturation: maximum === 0 ? 0 : ( maximum - minimum ) / maximum
  };

}

/** One eye's UV square, downsampled to characters, using the same thresholds the numbers used. */
function previewUvSquare( decoded, eye, disc ) {

  const bounds = eye.uvBounds;
  const lines = [];

  for ( let row = 0; row < PREVIEW_CELLS; row ++ ) {

    let line = '';

    for ( let column = 0; column < PREVIEW_CELLS; column ++ ) {

      const u = bounds.uMin + ( column + 0.5 ) / PREVIEW_CELLS * ( bounds.uMax - bounds.uMin );
      const v = bounds.vMin + ( row + 0.5 ) / PREVIEW_CELLS * ( bounds.vMax - bounds.vMin );
      const sample = readTexel( decoded,
        Math.min( decoded.width - 1, Math.floor( u * decoded.width ) ),
        Math.min( decoded.height - 1, Math.floor( v * decoded.height ) ) );

      if ( sample === null ) line += ' ';
      else if ( sample.luma < disc.lumaThreshold ) line += '@';
      else if ( sample.saturation > disc.saturationThreshold ) line += '#';
      else if ( sample.luma < disc.medianLuma ) line += '+';
      else line += '-';

    }

    lines.push( line );

  }

  return lines;

}

function median( values ) {
  const sorted = [ ...values ].sort( ( a, b ) => a - b );
  return sorted[ Math.floor( sorted.length / 2 ) ];
}

function describeSkinBinding( mesh ) {

  const skinIndex = mesh.geometry.attributes.skinIndex;
  const skinWeight = mesh.geometry.attributes.skinWeight;
  if ( skinIndex === undefined ) return 'not skinned';

  const totals = new Map();
  for ( let vertex = 0; vertex < skinIndex.count; vertex ++ ) {
    for ( const channel of [ 'X', 'Y', 'Z', 'W' ] ) {
      const weight = skinWeight[ `get${ channel }` ]( vertex );
      if ( weight <= 0 ) continue;
      const bone = skinIndex[ `get${ channel }` ]( vertex );
      totals.set( bone, ( totals.get( bone ) ?? 0 ) + weight );
    }
  }

  return [ ...totals.entries() ]
    .sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
    .map( ( [ bone, weight ] ) => `${ mesh.skeleton.bones[ bone ].name } (Σw ${ weight.toFixed( 1 ) })` )
    .join( ', ' );

}

// --- small maths ------------------------------------------------------------------------------

function normalise( vector ) {
  const length = Math.hypot( ...vector );
  return length === 0 ? [ 0, 0, 0 ] : vector.map( ( value ) => value / length );
}

function distance( a, b ) {
  return Math.hypot( a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ], a[ 2 ] - b[ 2 ] );
}

function angleBetweenDegrees( a, b ) {
  const dot = a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
  return Math.acos( Math.max( -1, Math.min( 1, dot ) ) ) * 180 / Math.PI;
}

function pearson( a, b ) {
  const meanA = a.reduce( ( x, y ) => x + y, 0 ) / a.length;
  const meanB = b.reduce( ( x, y ) => x + y, 0 ) / b.length;
  let covariance = 0, varianceA = 0, varianceB = 0;
  for ( let index = 0; index < a.length; index ++ ) {
    const da = a[ index ] - meanA;
    const db = b[ index ] - meanB;
    covariance += da * db; varianceA += da * da; varianceB += db * db;
  }
  return varianceA === 0 || varianceB === 0 ? 0 : covariance / Math.sqrt( varianceA * varianceB );
}

function rSquared( observed, predicted ) {
  const mean = observed.reduce( ( a, b ) => a + b, 0 ) / observed.length;
  let residual = 0, total = 0;
  observed.forEach( ( value, index ) => {
    residual += ( value - predicted[ index ] ) ** 2;
    total += ( value - mean ) ** 2;
  } );
  return total === 0 ? 0 : 1 - residual / total;
}

// --- reporting --------------------------------------------------------------------------------

function heading( text ) {
  console.log( `\n${ text }` );
  console.log( '='.repeat( Math.max( 60, text.length ) ) );
}

function row( label, value ) {
  console.log( `  ${ label.padEnd( 38 ) } ${ value }` );
}

function table( header, rows ) {
  const widths = header.map( ( cell, column ) =>
    Math.max( cell.length, ...rows.map( ( entry ) => String( entry[ column ] ).length ) ) );
  const render = ( cells ) => '  ' + cells
    .map( ( cell, column ) => String( cell ).padStart( widths[ column ] ) )
    .join( '  ' );
  console.log( render( header ) );
  console.log( '  ' + widths.map( ( width ) => '-'.repeat( width ) ).join( '  ' ) );
  for ( const entry of rows ) console.log( render( entry ) );
}

function format3( value ) { return value.toFixed( 3 ); }
function format4( value ) { return value.toFixed( 4 ); }
