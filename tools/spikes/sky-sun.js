// sky-sun.js — the sun model for punch-list 11.2, DERIVED FROM SkyMesh RATHER THAN CHOSEN BY EYE.
//
// 11.2 asks that "the key light is aimed along the same `sunPosition` and takes its colour and
// irradiance from the same elevation, so a scene cannot have its sky and its key disagree."
//
// The tempting way to satisfy that is a hand-authored ramp — 2000 K at the horizon, 5500 K at noon,
// interpolate. This file does not do that, because a hand-authored ramp is a SECOND model, and two
// models of the same sun is exactly how a sky and its key come to disagree. Instead every number
// below is computed from the constants that are already inside
// `node_modules/three/examples/jsm/objects/SkyMesh.js`, so the key light is literally reading the
// solar disc out of the sky that is being drawn behind it.
//
// ## What is ported, and from where
//
// SkyMesh's vertex stage computes, per frame:
//
//     sunfade            = 1 - clamp( 1 - exp( sunPosition.y / 450000 ), 0, 1 )
//     rayleighCoefficient= rayleigh - ( 1 - sunfade )
//     vBetaR             = totalRayleigh * rayleighCoefficient
//     c                  = 0.2 * turbidity * 1e-17
//     vBetaM             = 0.434 * c * MieConst * mieCoefficient
//     vSunE              = 1000 * max( 0, 1 - e^( -(cutoffAngle - acos(cosZenith)) / steepness ) )
//
// and its fragment stage, for a view ray pointed AT the sun, computes
//
//     inverse = 1 / ( cos(theta) + 0.15 * (93.885 - theta_deg)^-1.253 )      // Preetham eq. for air mass
//     Fex     = exp( -( vBetaR * 8.4e3 * inverse + vBetaM * 1.25e3 * inverse ) )
//     L_disc  = ( vSunE * 19000 * Fex ) * 0.04                               // the `* 0.04` is SkyMesh's
//
// `L_disc` is the RADIANCE of the solar disc in whatever units SkyMesh emits. A directional light
// that replaces that disc must carry its IRRADIANCE, which is radiance times the solid angle the
// disc subtends:
//
//     Omega_sun = 2 * pi * ( 1 - cos( 0.5 * 0.533 deg ) ) = 6.807e-5 sr
//
// so `E_sun = L_disc * Omega_sun`, in the same linear units the environment map is in. That is the
// whole derivation, and it is why the analytic key and the image-based sky cannot drift: they are
// two readings of one `Fex`.
//
// ## The one thing here that is a CHOICE and not a derivation
//
// SkyMesh has no spectrum. Its `Fex` is a per-channel transmittance applied to an extraterrestrial
// sun it implicitly treats as EQUAL-ENERGY IN RGB — i.e. as white, which in a linear-sRGB pipeline
// means D65, ~6500 K. The real extraterrestrial sun is ~5778 K (a G2V blackbody). Left uncorrected,
// this model's noon sun reads about 700 K too cool.
//
// `EXTRATERRESTRIAL_KELVIN` applies that correction, and `kelvinToLinearSRGB` is an APPROXIMATION
// FIT rather than a colorimetric computation — Tanner Helland's piecewise fit to the Mitchell
// Charity blackbody table (http://www.vendian.org/mncharity/dir3/blackbody/), converted from sRGB
// display values to linear here. Accurate to a few percent over 1000-15000 K, which is finer than
// the difference a viewer could name. ⚠️ It is a fit. It is labelled as one because this project
// has shipped six numbers that were not what their comment claimed.
//
// Everything else in this file is arithmetic on SkyMesh's own constants and can be checked by
// reading them side by side.

// --- SkyMesh constants, transcribed ------------------------------------------------------------
// Every one of these appears literally in SkyMesh.js. Line references are to r185.

const TOTAL_RAYLEIGH = [ 5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5 ];
const MIE_CONST = [ 1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14 ];
const CUTOFF_ANGLE = 1.6110731556870734;   // pi / 1.95, the "earth shadow hack"
const STEEPNESS = 1.5;
const SUN_INTENSITY_EE = 1000.0;
const RAYLEIGH_ZENITH_LENGTH = 8.4e3;
const MIE_ZENITH_LENGTH = 1.25e3;
const SUN_DISC_GAIN = 19000.0;             // L0 += vSunE * 19000 * Fex * sundisc
const SKY_OUTPUT_SCALE = 0.04;             // texColor = ( Lin + L0 ) * 0.04 + ...

/**
 * Solid angle of the solar disc as seen from Earth. 0.533 degrees mean angular diameter
 * (Allen, *Astrophysical Quantities*), so Omega = 2*pi*(1 - cos(radius)).
 */
export const SUN_SOLID_ANGLE_STERADIANS =
    2 * Math.PI * ( 1 - Math.cos( 0.5 * 0.533 * Math.PI / 180 ) );

/** The blackbody temperature SkyMesh's implicit white sun is corrected TO. See the header. */
export const EXTRATERRESTRIAL_KELVIN = 5778;

const DEGREES = Math.PI / 180;

/**
 * ⚠️ `sunPosition`'s MAGNITUDE IS NOT INERT, and that is a trap worth naming before the mapping.
 *
 * SkyMesh normalises `sunPosition` for the direction, but reads its RAW `.y` for the sun-fade term
 * `exp( sunPosition.y / 450000 )`. On a unit vector that exponent is ~1e-6, so `sunfade` pins to 1
 * and `rayleighCoefficient` equals the `rayleigh` uniform exactly. Set `sunPosition` on a sphere of
 * radius 450000 instead — as several three.js examples do — and `sunfade` becomes elevation-
 * dependent, `rayleighCoefficient` drops by up to 1, and the sky changes hue for a reason that is
 * invisible in the call site.
 *
 * This file, and the spike, use RADIUS 1, which matches three's own `webgl_shaders_sky` example.
 * Every number below assumes it.
 */
export const SUN_POSITION_RADIUS = 1;

/**
 * WORLD-SPACE sun direction from elevation and azimuth, three.js Y-up.
 *
 * `azimuthDegrees` is measured about +Y from world +Z, positive toward +X — the same convention
 * three's own sky example uses (`setFromSphericalCoords( 1, degToRad( 90 - elevation ), degToRad(
 * azimuth ) )`).
 *
 * 🚩 THIS IS NOT `LightingRig`'s AZIMUTH. `LightingRig.js:265` measures azimuth FROM THE CAMERA —
 * 0 degrees is a light sitting at the camera, positive toward the camera's right — precisely so a
 * rig follows the camera instead of silently becoming a different rig when the camera moves. The
 * sun does not follow the camera. A scene that copies a world sun azimuth straight into
 * `key.azimuthDegrees` gets a key that swings with the camera while the sky stays put, which is the
 * exact failure 11.2 exists to prevent. `rigAzimuthForSun()` below is the conversion.
 *
 * @param {number} elevationDegrees - above the horizon; negative is below it.
 * @param {number} azimuthDegrees - about +Y from +Z, positive toward +X.
 * @returns {{x:number,y:number,z:number}} unit vector, world space.
 */
export function sunDirectionWorld( elevationDegrees, azimuthDegrees ) {
    const polar = ( 90 - elevationDegrees ) * DEGREES;
    const azimuth = azimuthDegrees * DEGREES;
    const horizontal = Math.sin( polar );

    return {
        x: horizontal * Math.sin( azimuth ),
        y: Math.cos( polar ),
        z: horizontal * Math.cos( azimuth )
    };
}

/**
 * Converts a WORLD sun azimuth into the CAMERA-RELATIVE azimuth `LightingRig` wants, given where
 * the camera is standing relative to the focus.
 *
 * `LightingRig.solve()` builds its basis from `toCamera` (the focus-to-camera vector flattened to
 * the horizontal plane) and `right = ( toCamera.z, 0, -toCamera.x )`. A light at rig azimuth A sits
 * along `toCamera*cos(A) + right*sin(A)`. So rig azimuth 0 points at the camera, and the world
 * azimuth of the camera direction is `atan2( toCamera.x, toCamera.z )`.
 *
 * @param {number} sunAzimuthDegrees - world azimuth of the sun, per `sunDirectionWorld`.
 * @param {{x:number,z:number}} cameraOffsetFromFocus - camera position minus focus position.
 * @returns {number} azimuth in `LightingRig`'s camera-relative convention, in (-180, 180].
 */
export function rigAzimuthForSun( sunAzimuthDegrees, cameraOffsetFromFocus ) {
    const cameraAzimuth = Math.atan2( cameraOffsetFromFocus.x, cameraOffsetFromFocus.z ) / DEGREES;
    let relative = ( sunAzimuthDegrees - cameraAzimuth ) % 360;
    if ( relative > 180 ) relative -= 360;
    if ( relative <= -180 ) relative += 360;
    return relative;
}

/**
 * The whole model: elevation and the four sky uniforms in, the light the solar disc is out.
 *
 * @param {number} elevationDegrees
 * @param {Object} [sky]
 * @param {number} [sky.turbidity=2]
 * @param {number} [sky.rayleigh=1]
 * @param {number} [sky.mieCoefficient=0.005]
 * @returns {Object} the derived light, every field in the same linear units the sky is drawn in.
 */
export function solarDiscLight( elevationDegrees, sky = {} ) {
    const turbidity = sky.turbidity ?? 2;
    const rayleigh = sky.rayleigh ?? 1;
    const mieCoefficient = sky.mieCoefficient ?? 0.005;

    // Vertex stage. With |sunPosition| = 1 the sun-fade exponent is ~1e-6 and `sunfade` is 1 to
    // eleven places, so `rayleighCoefficient === rayleigh`. Computed rather than assumed, so that
    // a future radius change shows up here instead of silently.
    const sunPositionY = SUN_POSITION_RADIUS * Math.sin( elevationDegrees * DEGREES );
    const sunfade = 1 - clamp( 1 - Math.exp( sunPositionY / 450000 ), 0, 1 );
    const rayleighCoefficient = rayleigh - ( 1 - sunfade );

    const betaR = TOTAL_RAYLEIGH.map( ( component ) => component * rayleighCoefficient );

    const c = 0.2 * turbidity * 1e-17;
    const betaM = MIE_CONST.map( ( component ) => 0.434 * c * component * mieCoefficient );

    // `zenithAngleCos` is clamped to [-1,1] in the shader; below the horizon the sun-intensity
    // curve carries it to zero on its own via the max().
    const zenithAngleCos = clamp( Math.sin( elevationDegrees * DEGREES ), -1, 1 );
    const sunIntensity = SUN_INTENSITY_EE * Math.max(
        0,
        1 - Math.exp( -( CUTOFF_ANGLE - Math.acos( zenithAngleCos ) ) / STEEPNESS )
    );

    // Fragment stage, along the sun's own direction. `max(0, dot(up, dir))` clamps the optical
    // path at the horizon, which is what stops the 1/cos singularity.
    const zenithAngle = Math.acos( Math.max( 0, Math.sin( elevationDegrees * DEGREES ) ) );
    const zenithDegrees = zenithAngle / DEGREES;
    const airMassInverse = 1 / (
        Math.cos( zenithAngle ) + 0.15 * Math.pow( 93.885 - zenithDegrees, -1.253 )
    );

    const opticalRayleigh = RAYLEIGH_ZENITH_LENGTH * airMassInverse;
    const opticalMie = MIE_ZENITH_LENGTH * airMassInverse;

    const transmittance = [ 0, 1, 2 ].map( ( channel ) => Math.exp(
        -( betaR[ channel ] * opticalRayleigh + betaM[ channel ] * opticalMie )
    ) );

    // The disc as SkyMesh would draw it, then the same disc as a light.
    const discRadiance = transmittance.map(
        ( component ) => sunIntensity * SUN_DISC_GAIN * component * SKY_OUTPUT_SCALE
    );
    const irradianceRaw = discRadiance.map(
        ( component ) => component * SUN_SOLID_ANGLE_STERADIANS
    );

    // Colour correction: SkyMesh's implicit extraterrestrial sun is RGB-white (D65 in a linear
    // sRGB pipeline); the real one is a 5778 K blackbody. Without this the model's noon sun is
    // ~700 K too cool. This is the one non-derived step in the file.
    const extraterrestrial = kelvinToLinearSRGB( EXTRATERRESTRIAL_KELVIN );
    const corrected = irradianceRaw.map( ( component, channel ) => component * extraterrestrial[ channel ] );

    // 🚩 `irradiance` is the PEAK CHANNEL, not the luminance, and the choice is forced rather than
    // aesthetic. `LightingRig.js:1212` accumulates `irradiance * colour.r` per channel and
    // `solve()` hands `irradiance` to a three.js light whose own contribution is `color *
    // intensity`. Both multiply a scalar by a peak-normalised colour. Define `irradiance` as a
    // luminance instead and the product silently comes out ~15% low on a warm light, because a
    // peak-normalised warm colour has luminance below 1. Peak in, peak out, and the reconstruction
    // `colourLinear * irradiance === irradianceRGB` holds exactly.
    const peak = Math.max( corrected[ 0 ], corrected[ 1 ], corrected[ 2 ] );
    const colourNormalised = normaliseToPeak( corrected );

    return {
        elevationDegrees,
        sunIntensity,                       // SkyMesh's vSunE
        transmittance,                      // Fex, per channel
        discRadiance,                       // what a pixel on the disc would read
        irradiance: peak,                   // scalar, same units as the environment map
        luminance: relativeLuminance( corrected ),
        irradianceRGB: corrected,           // per-channel; equals colourLinear * irradiance
        colourLinear: colourNormalised,     // peak-normalised linear RGB, the rig's `colour`
        colourHex: linearToHex( colourNormalised ),
        correlatedColourTemperature: correlatedColourTemperature( corrected ),
        aboveHorizon: elevationDegrees > 0
    };
}

/**
 * The key-light placement a scene should hand `LightingRig.override()` for a given sun.
 *
 * `irradianceAnchor` is a CHOICE and is stated as one: it is the irradiance the derived key takes
 * at `anchorElevationDegrees`. Defaulting it to the studio key's own 3.0 at 60 degrees means a
 * near-noon outdoor scene puts the same amount of light on the subject as the calibration control
 * does, so the measured record in `docs/PROGRESS.md` stays roughly comparable instead of being
 * retired by an arbitrary exposure. Any other anchor is defensible; none of them is derivable.
 *
 * @param {number} elevationDegrees
 * @param {number} sunAzimuthDegrees - WORLD azimuth.
 * @param {{x:number,z:number}} cameraOffsetFromFocus
 * @param {Object} [options]
 * @param {Object} [options.sky] - turbidity / rayleigh / mieCoefficient.
 * @param {number} [options.anchorElevationDegrees=60]
 * @param {number} [options.irradianceAnchor=3.0] - `LightingRig` FORM_LIGHTS key irradiance.
 * @returns {Object} fields named to drop straight into a `LightPlacement`.
 */
export function keyPlacementForSun( elevationDegrees, sunAzimuthDegrees, cameraOffsetFromFocus, options = {} ) {
    const sky = options.sky ?? {};
    const anchorElevation = options.anchorElevationDegrees ?? 60;
    const anchorIrradiance = options.irradianceAnchor ?? 3.0;

    const here = solarDiscLight( elevationDegrees, sky );
    const anchor = solarDiscLight( anchorElevation, sky );
    const scale = anchor.irradiance > 0 ? anchorIrradiance / anchor.irradiance : 0;

    return {
        azimuthDegrees: rigAzimuthForSun( sunAzimuthDegrees, cameraOffsetFromFocus ),
        elevationDegrees,
        irradiance: here.irradiance * scale,
        irradianceUnscaled: here.irradiance,
        colour: here.colourHex,
        colourLinear: here.colourLinear,
        correlatedColourTemperature: here.correlatedColourTemperature,
        scaleToRigUnits: scale
    };
}

// --- colour helpers ----------------------------------------------------------------------------

/**
 * Blackbody colour as LINEAR sRGB, peak-normalised.
 *
 * ⚠️ An approximation fit, not a colorimetric computation: Tanner Helland's piecewise curve fit to
 * Mitchell Charity's blackbody table (http://www.vendian.org/mncharity/dir3/blackbody/), which is
 * itself tabulated for sRGB DISPLAY values — so the fit is evaluated in sRGB and then linearised
 * here. Valid 1000-40000 K, a few percent off across the daylight range.
 */
export function kelvinToLinearSRGB( kelvin ) {
    const t = clamp( kelvin, 1000, 40000 ) / 100;

    let red;
    if ( t <= 66 ) {
        red = 255;
    } else {
        red = 329.698727446 * Math.pow( t - 60, -0.1332047592 );
    }

    let green;
    if ( t <= 66 ) {
        green = 99.4708025861 * Math.log( t ) - 161.1195681661;
    } else {
        green = 288.1221695283 * Math.pow( t - 60, -0.0755148492 );
    }

    let blue;
    if ( t >= 66 ) {
        blue = 255;
    } else if ( t <= 19 ) {
        blue = 0;
    } else {
        blue = 138.5177312231 * Math.log( t - 10 ) - 305.0447927307;
    }

    const encoded = [ red, green, blue ].map( ( component ) => clamp( component, 0, 255 ) / 255 );
    const linear = encoded.map( srgbToLinear );

    return normaliseToPeak( linear );
}

/**
 * CCT from a linear-sRGB triple, via CIE 1931 XYZ and McCamy's cubic approximation
 * (C. S. McCamy, "Correlated color temperature as an explicit function of chromaticity
 * coordinates", *Color Research & Application* 17(2), 1992).
 *
 * ⚠️ McCamy's fit is only meaningful near the Planckian locus. A saturated horizon sun sits well
 * off it, so the number returned at low elevation is indicative, not a temperature anybody could
 * match with a filter. Reported anyway because it is the unit a lighting person thinks in.
 */
export function correlatedColourTemperature( linearRGB ) {
    const [ r, g, b ] = linearRGB;

    // sRGB / D65 primaries, IEC 61966-2-1.
    const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;

    const sum = X + Y + Z;
    if ( sum <= 0 ) return 0;

    const x = X / sum;
    const y = Y / sum;

    const n = ( x - 0.3320 ) / ( 0.1858 - y );
    return 437 * n * n * n + 3601 * n * n + 6861 * n + 5517;
}

export function relativeLuminance( linearRGB ) {
    return 0.2126729 * linearRGB[ 0 ] + 0.7151522 * linearRGB[ 1 ] + 0.0721750 * linearRGB[ 2 ];
}

function normaliseToPeak( linearRGB ) {
    const peak = Math.max( linearRGB[ 0 ], linearRGB[ 1 ], linearRGB[ 2 ] );
    if ( peak <= 0 ) return [ 0, 0, 0 ];
    return linearRGB.map( ( component ) => component / peak );
}

function linearToHex( linearRGB ) {
    const bytes = linearRGB.map( ( component ) => {
        const encoded = linearToSrgb( clamp( component, 0, 1 ) );
        return Math.round( encoded * 255 );
    } );
    return ( bytes[ 0 ] << 16 ) | ( bytes[ 1 ] << 8 ) | bytes[ 2 ];
}

function srgbToLinear( value ) {
    return value <= 0.04045 ? value / 12.92 : Math.pow( ( value + 0.055 ) / 1.055, 2.4 );
}

function linearToSrgb( value ) {
    return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow( value, 1 / 2.4 ) - 0.055;
}

function clamp( value, low, high ) {
    return Math.min( high, Math.max( low, value ) );
}
