import * as THREE from "three"
import type { Polygon } from "../geo"

/**
 * The lake: a flat sheet just under the bank, shaded in world space so its
 * pattern sits still while the camera moves. Colour from the sky, a path of
 * sun glints, rain rings, and lamplight when it's dark.
 */

export const WATER_Y = -0.32

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uCamDir;
uniform float uRain;
uniform float uNight;
uniform float uWind;
varying vec3 vWorld;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  // Quantise to 0.25 m so the water reads as pixels too.
  vec2 p = floor(vWorld.xz * 4.0) / 4.0;
  float t = uTime * (0.25 + uWind * 0.6);
  float w1 = n2(p * 0.18 + vec2(t * 0.6, t * 0.25));
  float w2 = n2(p * 0.42 - vec2(t * 0.3, -t * 0.5));
  float wave = w1 * 0.6 + w2 * 0.4;

  vec3 col = uDeep * (0.82 + wave * 0.3);
  // A little of the sky's low colour (the sunset's orange, the night's blue).
  col = mix(col, uSkyBottom * 0.55, 0.22);
  col *= wave < 0.42 ? 0.88 : 1.0;
  col *= 1.0 - uNight * 0.55;

  // Short horizontal glints, a pixel tall, that come and go.
  vec2 g2 = floor(vec2(vWorld.x * 1.2, vWorld.z * 4.0));
  float spark = step(0.985, h21(g2 + floor(uTime * 1.5 + h21(g2) * 4.0)));
  col += spark * mix(uSkyBottom, vec3(1.0), 0.5) * 0.35 * (1.0 - uNight * 0.7);

  // Sun glints along the reflected path.
  vec3 n = normalize(vec3((w1 - 0.5) * 0.7, 1.0, (w2 - 0.5) * 0.7));
  vec3 r = reflect(normalize(uCamDir), n);
  float g = pow(max(dot(r, normalize(uSun)), 0.0), 60.0);
  col += uSunColor * g * 1.6 * step(0.6, h21(p * 3.1 + floor(uTime * 4.0)));

  // Rain rings.
  if (uRain > 0.02) {
    vec2 cell = floor(p / 1.5);
    float h = h21(cell);
    float phase = fract(uTime * 0.9 + h * 7.0);
    vec2 c = (cell + 0.25 + 0.5 * vec2(h, h21(cell + 3.7))) * 1.5;
    float d = length(p - c);
    float ring = step(abs(d - phase * 0.7), 0.06) * (1.0 - phase) * step(h21(cell + floor(uTime * 0.9 + h * 7.0)), uRain);
    col += vec3(0.5, 0.55, 0.6) * ring * 0.6;
  }

  // Lamplight shimmer at night.
  col += vec3(1.0, 0.75, 0.4) * uNight * step(0.93, n2(p * 0.9 + t)) * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`

export function makeWater(polys: Polygon[]) {
  const geos: THREE.BufferGeometry[] = []
  for (const poly of polys) {
    const contour = poly.map(([x, z]) => new THREE.Vector2(x, z))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    const pos: number[] = []
    for (const [a, b, c] of tris) {
      for (const i of [a, c, b]) pos.push(poly[i][0], WATER_Y, poly[i][1])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    geos.push(g)
  }
  const material = new THREE.ShaderMaterial({
    // Either winding: the sheet is only ever seen from above.
    side: THREE.DoubleSide,
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x2f8296) },
      uSkyTop: { value: new THREE.Color() },
      uSkyBottom: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uCamDir: { value: new THREE.Vector3(0, -1, 0) },
      uRain: { value: 0 },
      uNight: { value: 0 },
      uWind: { value: 0.2 },
    },
  })
  const meshes = geos.map((g) => {
    const m = new THREE.Mesh(g, material)
    m.receiveShadow = false
    return m
  })
  return { meshes, material }
}
