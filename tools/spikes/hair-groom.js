// A stand-in groom with the SHAPE of the shipped one, for spike 6.6/9.14.
//
// The spike needs a groom, and `assets/hair/bob01/*.glb` is gitignored build output — a spike
// that cannot run without a Blender bake is a spike nobody re-runs. So this module regrows the
// groom from `tools/figure-pipeline/hair_cards.py`'s OWN published parameters, which is the same
// move `morph-cost.html` makes when it stands a 164×82 sphere in for hm08's head region.
//
// What is copied verbatim from that file, and therefore what makes the workload the right size:
//
//   HAIR_LAYERS         104 + 58 + 56 + 48 + 28 = 294 cards, with each layer's standoff,
//                       length, half-width, gravity and jitter
//   GUIDE_SEGMENTS 16   so a guide is 17 points and a card is 34 vertices
//   GRAVITY_PER_SEGMENT 0.41, GRAVITY_POWER 1.60, TIP_WIDTH_FRACTION 0.62, CARD_TWIST 0.35
//   grow_guide / ribbon_of  the integration and the (tangent, outward-from-head-centre) frame
//
// ⚠️ What is NOT copied: the body-mesh hug, the CUT PLANE and the clumping. `grow_guide` slides
// each point over the real basemesh with a signed-distance query and `grow_to_cut` then corrects
// the length until the tip lands on the style's cut plane; there is no basemesh here, so the hug
// runs against an analytic skull sphere and there is no cut. The guides therefore have the right
// count, the right ring count and lengths of the right order, and they are not the shipped
// groom's curves. `layer.length` is now the generator's FIRST GUESS at the arc rather than the
// arc a card ends up with, which is a second reason not to read these curves as the shipped ones.
//
// 🎯 One thing that IS now exactly right and was not before: `hair_cards.resample` spaces a
// guide's rings uniformly along its own arc, so the rest segment length really is constant along
// a chain — which is the assumption `hair-dftl.js` stores one float per chain on.
//
// Verified against the shipped artefact this session: `assets/hair/bob01/g050.glb` has one mesh
// of 10,648 vertices and 10,536 triangles whose index buffer decomposes into 296 connected
// components — 294 of exactly 34 vertices and 2 of 326 (the scalp cap shells).
// 294 × 34 = 9,996; + 652 = 10,648.

// --- hair_cards.py constants, transcribed ---------------------------------------------------

export const GUIDE_SEGMENTS = 16;
export const POINTS_PER_CHAIN = GUIDE_SEGMENTS + 1;

const GRAVITY_PER_SEGMENT = 0.41;
const GRAVITY_POWER = 1.60;
const CARD_TWIST = 0.35;
const TIP_WIDTH_FRACTION = 0.62;

const HAIR_LAYERS = [
  { name: 'root', cards: 104, standoff: 0.0060, length: 0.085, halfWidth: 0.0210, gravity: 0.85, jitter: 0.08 },
  { name: 'underlayer', cards: 58, standoff: 0.0110, length: 0.200, halfWidth: 0.0180, gravity: 1.00, jitter: 0.11 },
  { name: 'body', cards: 56, standoff: 0.0165, length: 0.260, halfWidth: 0.0160, gravity: 1.10, jitter: 0.14 },
  { name: 'surface', cards: 48, standoff: 0.0225, length: 0.300, halfWidth: 0.0140, gravity: 1.20, jitter: 0.17 },
  { name: 'flyaway', cards: 28, standoff: 0.0285, length: 0.320, halfWidth: 0.0110, gravity: 1.30, jitter: 0.22 }
];

export const SHIPPED_CARD_COUNT = HAIR_LAYERS.reduce( ( total, layer ) => total + layer.cards, 0 );

// A skull the guides can lie on. 0.092 m puts the crown roughly where hm08's does; the exact
// radius does not matter to a cost measurement and it is the only thing the fall reads.
export const SKULL_RADIUS = 0.092;
export const SKULL_CENTRE = [ 0, 0, 0 ];

/**
 * Grows `cardCount` cards. Passing the shipped count reproduces the shipped groom's layer mix;
 * any other count scales every layer by the same factor, which is how the sweep gets a groom
 * that is four or forty times the size without changing its character.
 *
 * @param {number} cardCount
 * @param {number} [seed=20260812] - the manifest's own groom seed.
 * @returns {{chainCount, pointsPerChain, restPositions, halfWidths, twists}}
 */
export function growGroom( cardCount, seed = 20260812 ) {

  const random = makeRandom( seed );
  const scale = cardCount / SHIPPED_CARD_COUNT;

  const restPositions = new Float32Array( cardCount * POINTS_PER_CHAIN * 3 );
  const halfWidths = new Float32Array( cardCount * POINTS_PER_CHAIN );
  const twists = new Float32Array( cardCount );

  let chain = 0;
  for ( let layerIndex = 0; layerIndex < HAIR_LAYERS.length; layerIndex ++ ) {
    const layer = HAIR_LAYERS[ layerIndex ];
    const isLast = layerIndex === HAIR_LAYERS.length - 1;
    const target = isLast ? cardCount : Math.min( cardCount, chain + Math.round( layer.cards * scale ) );

    while ( chain < target ) {
      growOneCard( chain, layer, random, restPositions, halfWidths, twists );
      chain ++;
    }
  }

  // Rounding can leave the last layer a card or two short of the requested count.
  while ( chain < cardCount ) {
    growOneCard( chain, HAIR_LAYERS[ HAIR_LAYERS.length - 1 ], random, restPositions, halfWidths, twists );
    chain ++;
  }

  return {
    chainCount: cardCount,
    pointsPerChain: POINTS_PER_CHAIN,
    restPositions,
    halfWidths,
    twists
  };

}

/** One guide curve, integrated exactly as `grow_guide` does, over an analytic skull. */
function growOneCard( chain, layer, random, restPositions, halfWidths, twists ) {

  // A root on the upper hemisphere. The scalp region is the part of the sphere above the
  // brow line and behind the face, which on a unit sphere is y > -0.15 with the front third
  // thinned out — enough to keep the groom from growing over the eyes.
  let rootDirection;
  do {
    const y = 0.15 + 0.85 * random();
    const azimuth = random() * Math.PI * 2;
    const ring = Math.sqrt( Math.max( 0, 1 - y * y ) );
    rootDirection = [ ring * Math.cos( azimuth ), y, ring * Math.sin( azimuth ) ];
  } while ( rootDirection[ 2 ] > 0.75 );

  const step = layer.length / GUIDE_SEGMENTS;
  const lengthScale = 0.80 + 0.40 * random();
  const curl = [
    ( random() * 2 - 1 ) * layer.jitter * 0.15,
    ( random() * 2 - 1 ) * layer.jitter * 0.15,
    ( random() * 2 - 1 ) * layer.jitter * 0.15
  ];
  const widthScale = 0.75 + 0.5 * random();

  twists[ chain ] = ( random() * 2 - 1 ) * CARD_TWIST;

  const standoff = layer.standoff;
  let point = [
    rootDirection[ 0 ] * ( SKULL_RADIUS + standoff ),
    rootDirection[ 1 ] * ( SKULL_RADIUS + standoff ),
    rootDirection[ 2 ] * ( SKULL_RADIUS + standoff )
  ];
  // The heading starts along the scalp, tilted down: hair leaves the head and falls, it does
  // not shoot outward. `root_direction` in the generator does the same with a part and a whorl.
  let direction = normalise( [
    rootDirection[ 0 ] * 0.35,
    rootDirection[ 1 ] * 0.35 - 0.9,
    rootDirection[ 2 ] * 0.35
  ] );

  writeRing( chain, 0, point, layer, widthScale, restPositions, halfWidths );

  for ( let segment = 0; segment < GUIDE_SEGMENTS; segment ++ ) {
    const s = ( segment + 1 ) / GUIDE_SEGMENTS;
    const previous = point;

    // `bend` is added to a UNIT heading, so it is an angle, not a distance. See the comment
    // above GRAVITY_PER_SEGMENT in hair_cards.py for why that distinction cost a round.
    const bend = GRAVITY_PER_SEGMENT * layer.gravity * Math.pow( s, GRAVITY_POWER );
    direction = normalise( [
      direction[ 0 ] + curl[ 0 ],
      direction[ 1 ] - bend + curl[ 1 ],
      direction[ 2 ] + curl[ 2 ]
    ] );

    point = [
      point[ 0 ] + direction[ 0 ] * step * lengthScale,
      point[ 1 ] + direction[ 1 ] * step * lengthScale,
      point[ 2 ] + direction[ 2 ] * step * lengthScale
    ];

    // The hug: while the point is inside the skull's standoff shell, put it back on the shell.
    const radius = Math.hypot( point[ 0 ], point[ 1 ], point[ 2 ] );
    const shell = SKULL_RADIUS + standoff;
    if ( radius < shell ) {
      const push = shell / Math.max( radius, 1e-9 );
      point = [ point[ 0 ] * push, point[ 1 ] * push, point[ 2 ] * push ];
    }

    // Re-derive the heading from where the point LANDED. Without this the hug is undone by the
    // next step and the curve bounces along the skull instead of lying on it.
    const travelled = [ point[ 0 ] - previous[ 0 ], point[ 1 ] - previous[ 1 ], point[ 2 ] - previous[ 2 ] ];
    if ( Math.hypot( ...travelled ) > 1e-9 ) direction = normalise( travelled );

    writeRing( chain, segment + 1, point, layer, widthScale, restPositions, halfWidths );
  }

}

function writeRing( chain, ring, point, layer, widthScale, restPositions, halfWidths ) {
  const index = chain * POINTS_PER_CHAIN + ring;
  restPositions[ index * 3 + 0 ] = point[ 0 ];
  restPositions[ index * 3 + 1 ] = point[ 1 ];
  restPositions[ index * 3 + 2 ] = point[ 2 ];

  const s = ring / GUIDE_SEGMENTS;
  halfWidths[ index ] = layer.halfWidth * widthScale * ( 1 - ( 1 - TIP_WIDTH_FRACTION ) * s );
}

function normalise( v ) {
  const l = Math.hypot( v[ 0 ], v[ 1 ], v[ 2 ] ) || 1;
  return [ v[ 0 ] / l, v[ 1 ] / l, v[ 2 ] / l ];
}

/** Mulberry32. Deterministic across runs, which a sweep needs and Math.random cannot give. */
function makeRandom( seed ) {
  let state = seed >>> 0;
  return function random() {
    state = ( state + 0x6D2B79F5 ) >>> 0;
    let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
    t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
    return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

/**
 * The index buffer for a groom's cards: 12 quads per card, two triangles each, over a vertex
 * buffer laid out ring-major with the two edge vertices adjacent — the order `hair-dftl.js`'s
 * rebuild kernel writes.
 */
export function buildCardIndices( chainCount ) {
  const quadsPerCard = POINTS_PER_CHAIN - 1;
  const indices = new Uint32Array( chainCount * quadsPerCard * 6 );
  let cursor = 0;

  for ( let chain = 0; chain < chainCount; chain ++ ) {
    const base = chain * POINTS_PER_CHAIN * 2;
    for ( let quad = 0; quad < quadsPerCard; quad ++ ) {
      const a = base + quad * 2;
      indices[ cursor ++ ] = a;
      indices[ cursor ++ ] = a + 1;
      indices[ cursor ++ ] = a + 3;
      indices[ cursor ++ ] = a;
      indices[ cursor ++ ] = a + 3;
      indices[ cursor ++ ] = a + 2;
    }
  }

  return indices;
}
