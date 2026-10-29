import * as THREE from "three"

/**
 * Shared uniforms and the few materials everything is drawn with. All of
 * them are three.js toon materials (three light bands, which reads as pixel
 * art once the frame is pixelated), patched for:
 *
 * - `sway`: per-vertex wind (leaves, flags, washing);
 * - `emit`: per-vertex light that comes on with the street lights (windows,
 *   lamp heads, the stupa's strings of bulbs);
 * - wet ground: upward faces darken and catch the sky in rain;
 * - see-through: anything between the camera and the player dissolves in a
 *   dither so you never lose yourself behind a building.
 */

export const U = {
  uTime: { value: 0 },
  uWind: { value: 0.2 },
  uNight: { value: 0 },
  uWet: { value: 0 },
  uSky: { value: new THREE.Color(0.5, 0.6, 0.8) },
  /** The player's chest in view space. */
  uPlayerView: { value: new THREE.Vector3() },
  /** Radius of the see-through circle, in metres. */
  uFadeR: { value: 3.2 },
}

/**
 * The light ramp, indexed by N·L mapped to 0–1: the shadowed half stays
 * dark, then four bands. Grazing light (a low sun on flat ground) lands in
 * the dim first band, so a sunset lights walls, not the whole floor.
 */
function gradient() {
  const data = new Uint8Array([24, 24, 26, 28, 118, 168, 222, 255])
  const t = new THREE.DataTexture(data, 8, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

const BAYER = /* glsl */ `
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}
`

type Opts = { fade?: boolean; signs?: boolean; ground?: boolean }

function patch(material: THREE.MeshToonMaterial, opts: Opts) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U)
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime;
uniform float uWind;
attribute vec3 emit;
attribute float sway;
varying vec3 vEmit;
varying vec3 vWorld;
varying float vUp;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float w = sway * (0.05 + uWind * 0.16);
transformed.x += sin(uTime * 1.9 + position.x * 0.35 + position.z * 0.27) * w;
transformed.z += cos(uTime * 1.6 + position.x * 0.21 - position.z * 0.3) * w * 0.7;
vEmit = emit;
vUp = normal.y;`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uNight;
uniform float uWet;
uniform vec3 uSky;
uniform vec3 uPlayerView;
uniform float uFadeR;
varying vec3 vEmit;
varying vec3 vWorld;
varying float vUp;
${BAYER}`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
${
  opts.fade
    ? `{
  vec3 fv = -vViewPosition;
  if (vWorld.y > 0.35 && fv.z > uPlayerView.z + 0.6) {
    float d = length(fv.xy - uPlayerView.xy);
    float a = 1.0 - smoothstep(uFadeR * 0.45, uFadeR, d);
    if (a > 0.0 && bayer4(gl_FragCoord.xy) < a * 0.97) discard;
  }
}`
    : ""
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float wetUp = smoothstep(0.6, 0.95, vUp) * uWet;
diffuseColor.rgb *= 1.0 - wetUp * 0.42 - uWet * 0.08;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vEmit * uNight;
${opts.signs ? "totalEmissiveRadiance += diffuseColor.rgb * uNight * 0.55;" : ""}`
      )
      .replace(
        "#include <opaque_fragment>",
        `outgoingLight += uSky * wetUp * (0.16 + 0.1 * step(0.5, fract(sin(dot(floor(vWorld.xz * 1.5), vec2(12.9898, 78.233))) * 43758.5453)));
#include <opaque_fragment>`
      )
  }
  material.customProgramCacheKey = () => `doon-${opts.fade ? 1 : 0}${opts.signs ? 1 : 0}${opts.ground ? 1 : 0}`
  return material
}

export type Materials = {
  world: THREE.MeshToonMaterial
  ground: THREE.MeshToonMaterial
  signs: THREE.MeshToonMaterial
  actor: THREE.MeshToonMaterial
  gradient: THREE.DataTexture
  dispose(): void
}

export function makeMaterials(atlas: THREE.Texture | null): Materials {
  const g = gradient()
  const world = patch(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g }), { fade: true })
  const ground = patch(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g }), { ground: true })
  const signs = patch(new THREE.MeshToonMaterial({ map: atlas, gradientMap: g }), { fade: true, signs: true })
  const actor = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g })
  return {
    world,
    ground,
    signs,
    actor,
    gradient: g,
    dispose() {
      for (const m of [world, ground, signs, actor]) m.dispose()
      g.dispose()
    },
  }
}
