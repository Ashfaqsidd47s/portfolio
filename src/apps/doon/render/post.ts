import * as THREE from "three"

/**
 * The pixel pass. The scene is rendered small (a few screen pixels to each
 * of its pixels); this pass blows it up with nearest sampling, shifted by
 * the camera's sub-pixel remainder so motion stays smooth while every pixel
 * stays square. On the way it adds the outlines (where depth jumps), soft
 * pixel halos round lamps, cloud shadows and ground mist (from the depth,
 * rebuilt into world space), pixel rain, lightning, the sky at the edges of
 * the diorama, grading and a light ordered dither.
 */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uScale;
uniform vec2 uOffset;
uniform float uNear;
uniform float uFar;
uniform mat4 uInvViewProj;
uniform float uTime;
uniform float uRain;
uniform float uMist;
uniform float uCloud;
uniform float uNight;
uniform float uFlash;
uniform float uWind;
uniform float uSat;
uniform vec3 uTint;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uMistColor;
uniform float uFade;
varying vec2 vUv;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return n2(p) * 0.55 + n2(p * 2.03 + 7.1) * 0.3 + n2(p * 4.1 - 3.3) * 0.15; }
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}
float depthAt(vec2 cell) { return texture2D(tDepth, cell / uRes).r; }
vec3 colourAt(vec2 cell) { return texture2D(tColor, cell / uRes).rgb; }
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Device pixels → scene pixels, whole numbers of each.
  vec2 px = gl_FragCoord.xy / uScale + 1.0 + uOffset;
  vec2 cell = floor(px) + 0.5;
  vec3 col = colourAt(cell);
  float d = depthAt(cell);
  bool sky = d >= 0.99999;

  if (sky) {
    // The space around the diorama: the sky's own gradient, stars at night.
    col = mix(uSkyBottom, uSkyTop, smoothstep(0.0, 1.0, vUv.y));
    float star = step(0.9965, h21(floor(cell))) * uNight * (0.6 + 0.4 * sin(uTime * 2.0 + h21(cell) * 40.0));
    col += vec3(star);
  } else {
    float z = mix(uNear, uFar, d);
    // Outlines: darken where a neighbour is well behind this pixel.
    float edge = 0.0;
    vec2 o[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
    for (int i = 0; i < 4; i++) {
      float zn = mix(uNear, uFar, depthAt(cell + o[i]));
      edge = max(edge, step(1.1, zn - z));
    }
    col *= 1.0 - edge * 0.42;

    // Back to world space for the weather.
    vec4 ndc = vec4((cell / uRes) * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 w = uInvViewProj * ndc;
    w /= w.w;
    vec2 drift = vec2(uTime * (0.6 + uWind * 2.5), uTime * 0.25);
    float cloud = fbm(w.xz * 0.011 + drift * 0.01);
    col *= 1.0 - uCloud * 0.38 * smoothstep(0.42, 0.62, cloud) * (1.0 - uNight * 0.8);

    float mist = uMist * (0.5 + 0.5 * fbm(w.xz * 0.025 + drift * 0.02)) * exp(-max(w.y, 0.0) * 0.06);
    col = mix(col, uMistColor, clamp(mist * (0.3 + 0.3 * vUv.y), 0.0, 0.62));
  }

  // Halos round anything bright (lamps, windows, the stupa's lights).
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 dir = vec2(cos(a), sin(a));
    vec3 c1 = colourAt(cell + dir * 2.0);
    vec3 c2 = colourAt(cell + dir * 4.0);
    glow += max(c1 - 1.35, 0.0) * 0.6 + max(c2 - 1.35, 0.0) * 0.3;
  }
  col += glow * (0.06 + 0.12 * uNight);

  col *= uTint;
  col += uFlash * vec3(0.75, 0.8, 1.0) * 0.9;
  col = 1.0 - exp(-col * 1.45);
  col = toSrgb(col);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * 1.04 + 0.5;

  // Rain: one-pixel streaks slanted by the wind, in two depths.
  if (uRain > 0.01) {
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      float slant = 0.22 + uWind * 0.25;
      vec2 p = cell + vec2((cell.y) * slant, 0.0);
      float column = floor(p.x / (3.0 + fl * 2.0));
      float hc = h21(vec2(column, fl * 13.0));
      float speed = (180.0 + hc * 90.0) * (1.0 + fl * 0.5);
      float y = p.y + uTime * speed + hc * 997.0;
      float span = 46.0 + hc * 40.0 - fl * 10.0;
      float seg = mod(y, span);
      float on = step(seg, 5.0 + fl * 3.0) * step(h21(vec2(column, floor(y / span))), uRain * (0.55 + fl * 0.25));
      on *= step(fract(p.x / (3.0 + fl * 2.0)), 0.34);
      col = mix(col, vec3(0.78, 0.84, 0.92), on * (0.32 + fl * 0.16));
    }
    col *= 1.0 - uRain * 0.06;
  }

  // Vignette, deeper at night.
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * (0.35 + uNight * 0.45);

  // A light ordered dither into 40 levels: the banding is part of the look.
  col = floor(col * 40.0 + bayer4(floor(px))) / 40.0;
  col = mix(col, vec3(0.0), uFade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

export class Post {
  readonly material: THREE.ShaderMaterial
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 3 },
        uOffset: { value: new THREE.Vector2() },
        uNear: { value: 1 },
        uFar: { value: 1000 },
        uInvViewProj: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uRain: { value: 0 },
        uMist: { value: 0 },
        uCloud: { value: 0 },
        uNight: { value: 0 },
        uFlash: { value: 0 },
        uWind: { value: 0 },
        uSat: { value: 1 },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uSkyTop: { value: new THREE.Color() },
        uSkyBottom: { value: new THREE.Color() },
        uMistColor: { value: new THREE.Color() },
        uFade: { value: 0 },
      },
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    const tri = new THREE.Mesh(g, this.material)
    tri.frustumCulled = false
    this.scene.add(tri)
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(null)
    renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.material.dispose()
  }
}
