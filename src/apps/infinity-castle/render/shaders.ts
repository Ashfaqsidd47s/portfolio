import { MAX_LIGHTS, PART_COUNT } from "./kit"

/**
 * GLSL for the castle. Every surface is painted procedurally in one
 * uber-shader keyed on a per-vertex material id; there are no textures.
 *
 * Light: each block carries its own lanterns (in its own frame, so they
 * travel with it when Nakime moves it), plus a faint glow around the
 * viewer and a dim hemisphere. Everything sinks into the same fog the sky
 * is painted with, so distant rooms dissolve into the abyss.
 */

/** Fog / sky colour by view direction, shared so geometry melts into the sky. */
export const FOG = /* glsl */ `
uniform vec3 uFogUp;
uniform vec3 uFogMid;
uniform vec3 uFogDown;
uniform float uFogDensity;
vec3 fogColor(vec3 dir) {
  float y = dir.y;
  vec3 c = y > 0.0 ? mix(uFogMid, uFogUp, smoothstep(0.0, 0.7, y)) : mix(uFogMid, uFogDown, smoothstep(0.0, 0.6, -y));
  return c;
}
vec3 applyFog(vec3 col, vec3 world, vec3 cam) {
  vec3 d = world - cam;
  float dist = length(d);
  float f = 1.0 - exp(-pow(dist * uFogDensity, 1.6));
  return mix(col, fogColor(d / max(dist, 1e-3)), clamp(f, 0.0, 1.0));
}
`

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 7.1;
    a *= 0.5;
  }
  return s;
}
`

/** Fragment-only: antialiased line of half-width w around every integer of x. */
export const GRID = /* glsl */ `
float gridLine(float x, float w) {
  float d = abs(fract(x + 0.5) - 0.5);
  float aa = fwidth(x) * 1.2;
  return 1.0 - smoothstep(w - aa, w + aa, d);
}
`

export const castleVertex = /* glsl */ `
attribute float aMat;
attribute float aPart;
attribute vec3 aSlide;
uniform float uOpen[${PART_COUNT}];
varying vec3 vLocal;
varying vec3 vNormalL;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
flat varying int vMat;
void main() {
  vec3 p = position + aSlide * uOpen[int(aPart + 0.5)];
  vLocal = p;
  vNormalL = normal;
  vUv = uv;
  vMat = int(aMat + 0.5);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const castleFragment = /* glsl */ `
precision highp float;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform int uLightCount;
uniform float uLightPower;
uniform vec3 uCamLocal;
uniform float uTime;
uniform float uSeed;
uniform float uVariant;
uniform float uGlow;
uniform float uPulse;
varying vec3 vLocal;
varying vec3 vNormalL;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
flat varying int vMat;
${NOISE}
${GRID}
${FOG}

struct Surface { vec3 albedo; vec3 emit; float spec; float shine; };

float flicker(float i) {
  float t = uTime * (5.0 + hash11(i * 3.7 + uSeed) * 4.0) + i * 13.1 + uSeed * 40.0;
  return 0.84 + 0.1 * sin(t) + 0.06 * sin(t * 2.7 + 1.3);
}

vec3 woodColor(vec2 uv, vec3 dark, vec3 light) {
  float g = fbm(vec2(uv.x * 0.6, uv.y * 22.0));
  float rings = sin(uv.y * 70.0 + g * 9.0) * 0.5 + 0.5;
  return mix(dark, light, g * 0.75 + rings * 0.25);
}

// Gold leaf with drifting ink clouds; seigaiha waves; crimson with gold squares.
vec3 fusumaPaint(vec2 uv, float variant) {
  vec3 col;
  if (variant < 0.34) {
    vec3 gold = vec3(0.62, 0.44, 0.17);
    float leaf = gridLine(uv.x / 0.14, 0.03) + gridLine(uv.y / 0.14, 0.03);
    col = gold * (0.88 + 0.12 * vnoise(uv * 9.0)) - leaf * 0.04;
    float cloud = fbm(vec2(uv.x * 0.45, uv.y * 1.3) + uSeed * 9.0);
    float band = smoothstep(0.52, 0.56, cloud) * (1.0 - smoothstep(0.66, 0.7, cloud));
    col = mix(col, vec3(0.86, 0.72, 0.42), band * 0.7);
    float pine = smoothstep(0.62, 0.66, fbm(uv * vec2(1.1, 0.5) + 3.0 + uSeed * 4.0));
    col = mix(col, vec3(0.06, 0.12, 0.08), pine * step(uv.y, 1.6) * 0.85);
  } else if (variant < 0.67) {
    // Seigaiha: rows of overlapping wave arcs; a lower row covers the row above.
    vec2 g = uv / 0.3;
    float m = -1.0;
    float k0 = floor(g.y / 0.5);
    for (int j = 0; j < 4; j++) {
      float k = k0 - float(j);
      float shift = mod(k, 2.0);
      float xc = floor((g.x - shift) / 2.0 + 0.5) * 2.0 + shift;
      float d = length(g - vec2(xc, k * 0.5));
      if (d < 1.0) m = d;
    }
    float rings = m < 0.0 ? 0.0 : gridLine(m * 4.0, 0.14);
    col = mix(vec3(0.72, 0.66, 0.52), vec3(0.11, 0.18, 0.34), rings * 0.85);
  } else {
    vec3 red = vec3(0.32, 0.05, 0.04);
    float sq = gridLine(uv.x / 0.42, 0.012) + gridLine(uv.y / 0.42, 0.012);
    vec2 c = floor(uv / 0.42);
    float speck = step(0.82, hash12(c + uSeed * 31.0));
    col = red * (0.85 + 0.15 * vnoise(uv * 6.0)) + vec3(0.5, 0.36, 0.1) * (sq * 0.4 + speck * 0.35);
  }
  // Panel frames every 0.8 m, and the round pull.
  float frame = gridLine(uv.x / 0.8, 0.03);
  col = mix(col, vec3(0.05, 0.025, 0.015), frame);
  float pull = 1.0 - smoothstep(0.035, 0.045, length(vec2(abs(fract(uv.x / 0.8 + 0.5) - 0.5) * 0.8 - 0.32, uv.y - 1.05)));
  col = mix(col, vec3(0.08, 0.06, 0.04), pull);
  return col;
}

Surface surface(int mat, vec2 uv, vec3 local, vec3 n) {
  Surface s;
  s.emit = vec3(0.0);
  s.spec = 0.1;
  s.shine = 16.0;
  if (mat == 0) {
    s.albedo = woodColor(uv, vec3(0.055, 0.026, 0.014), vec3(0.14, 0.07, 0.035));
    s.spec = 0.3; s.shine = 34.0;
  } else if (mat == 1) {
    vec3 w = woodColor(uv, vec3(0.2, 0.1, 0.045), vec3(0.36, 0.2, 0.09));
    float seam = gridLine(uv.y / 0.22, 0.02) * step(0.5, abs(n.y));
    s.albedo = w * (1.0 - seam * 0.6);
    s.spec = 0.55; s.shine = 60.0;
  } else if (mat == 2) {
    // Tatami: 0.9 × 1.8 mats, alternating, with dark cloth borders.
    vec2 p = local.xz + 50.0;
    vec2 cell = floor(p / 1.8);
    vec2 f = fract(p / 1.8) * 1.8;
    bool alongX = mod(cell.x + cell.y, 2.0) < 1.0;
    float across = alongX ? f.y : f.x;
    float along = alongX ? f.x : f.y;
    float half_ = step(0.9, across);
    float a = across - half_ * 0.9;
    float weave = 0.5 + 0.5 * sin(along * 260.0);
    float tone = hash12(cell * 2.0 + half_ + uSeed);
    vec3 straw = mix(vec3(0.3, 0.29, 0.12), vec3(0.42, 0.38, 0.17), tone);
    s.albedo = straw * (0.88 + 0.12 * weave) * (0.9 + 0.1 * vnoise(p * 3.0));
    float border = 1.0 - step(0.045, min(a, 0.9 - a));
    s.albedo = mix(s.albedo, vec3(0.02, 0.04, 0.03), border);
    s.spec = 0.18; s.shine = 12.0;
  } else if (mat == 3) {
    // Shoji: glowing paper on a lattice.
    float lat = max(gridLine(uv.x / 0.3, 0.05), gridLine(uv.y / 0.36, 0.05));
    float paper = 0.85 + 0.15 * vnoise(uv * 14.0);
    s.albedo = mix(vec3(0.7, 0.62, 0.5) * paper, vec3(0.06, 0.03, 0.015), lat);
    s.emit = vec3(1.0, 0.6, 0.28) * 0.42 * paper * (1.0 - lat) * uGlow;
  } else if (mat == 4) {
    s.albedo = fusumaPaint(uv, uVariant);
    s.spec = 0.25; s.shine = 22.0;
  } else if (mat == 5) {
    float row = fract(uv.y / 0.28);
    float ridge = 0.5 + 0.5 * cos(uv.x / 0.32 * 6.2831);
    s.albedo = vec3(0.05, 0.055, 0.065) * (0.6 + 0.4 * ridge) * (0.7 + 0.3 * smoothstep(0.0, 0.25, row));
    s.spec = 0.45; s.shine = 40.0;
  } else if (mat == 6) {
    // Chōchin: ribbed paper with dark caps, lit from inside.
    float ribs = 0.75 + 0.25 * sin(uv.y * 3.1416 * 14.0);
    float ink = smoothstep(0.42, 0.46, uv.y) * (1.0 - smoothstep(0.58, 0.62, uv.y)) * step(0.35, fract(uv.x * 3.0));
    float white = step(0.86, hash11(uSeed * 17.0));
    vec3 paper = mix(vec3(1.0, 0.24, 0.07), vec3(1.0, 0.72, 0.42), white);
    s.albedo = paper * 0.3;
    s.emit = paper * 2.6 * ribs * (1.0 - ink * 0.75) * flicker(floor(uv.x * 4.0) + local.x) * uGlow;
  } else if (mat == 7) {
    s.albedo = vec3(0.34, 0.035, 0.025) * (0.85 + 0.15 * vnoise(uv * 4.0));
    s.spec = 0.6; s.shine = 50.0;
  } else if (mat == 8) {
    s.albedo = vec3(0.62, 0.58, 0.5) * (0.9 + 0.1 * vnoise(uv * 8.0));
  } else if (mat == 9) {
    // Akaza's compass needle: a twelve-armed snowflake burned into the boards.
    s.albedo = woodColor(uv, vec3(0.08, 0.04, 0.02), vec3(0.18, 0.09, 0.04));
    vec2 p = local.xz;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float arms = abs(sin(ang * 6.0)) * r;
    float line = (1.0 - smoothstep(0.02, 0.06, arms)) * step(r, 4.9);
    float twig = (1.0 - smoothstep(0.02, 0.05, abs(fract(r / 0.9) - 0.5) * 0.9 - 0.0)) * (1.0 - smoothstep(0.0, 0.35, arms));
    float ring = gridLine(r / 2.4, 0.012) * step(r, 5.0) + gridLine((r - 0.6) / 4.3, 0.01) * step(r, 5.0);
    float glow = clamp(line + twig * 0.8 + ring, 0.0, 1.0);
    s.emit = vec3(0.35, 0.75, 1.0) * glow * (1.4 + 0.6 * sin(uTime * 1.6) + uPulse * 3.0);
  } else if (mat == 10) {
    // Ice over a pond: cracks, and dark water with rings in the middle.
    vec2 p = local.xz;
    float r = length(p);
    float crack = 1.0 - smoothstep(0.0, 0.03, abs(fbm(p * 1.4) - 0.5));
    vec3 ice = mix(vec3(0.16, 0.22, 0.27), vec3(0.32, 0.4, 0.46), vnoise(p * 2.0));
    vec3 water = vec3(0.01, 0.03, 0.05) + 0.03 * sin(r * 18.0 - uTime * 1.5);
    float pond = 1.0 - smoothstep(2.9, 3.0, r);
    s.albedo = mix(ice + crack * 0.12, water, pond);
    s.emit = vec3(0.1, 0.28, 0.42) * (crack * 0.35 + pond * 0.12 * (0.5 + 0.5 * sin(r * 6.0 - uTime)));
    s.spec = 0.7; s.shine = 90.0;
  } else if (mat == 11) {
    vec2 c = uv - 0.5;
    float edge = smoothstep(0.1, 0.5, length(c));
    s.albedo = mix(vec3(0.95, 0.75, 0.82), vec3(0.85, 0.35, 0.55), edge);
    s.emit = s.albedo * 0.35;
  } else if (mat == 12) {
    // Upper One's walls: rows of eyes and crescent moons on violet black.
    vec2 g = uv / vec2(0.8, 0.7);
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    s.albedo = vec3(0.05, 0.025, 0.06) * (0.8 + 0.2 * vnoise(uv * 5.0));
    float h = hash12(cell + 3.0);
    if (h > 0.45) {
      float eye = length(f * vec2(1.0, 2.6));
      float lid = 1.0 - smoothstep(0.24, 0.26, eye);
      float iris = 1.0 - smoothstep(0.08, 0.1, length(f));
      float blink = step(0.06, fract(uTime * 0.13 + h * 7.0));
      s.emit = (vec3(0.65, 0.5, 0.2) * lid * 0.4 + vec3(1.0, 0.25, 0.1) * iris * 1.2) * blink;
      s.albedo = mix(s.albedo, vec3(0.75, 0.68, 0.5), lid * (1.0 - iris) * blink);
    } else if (h > 0.2) {
      float moon = (1.0 - smoothstep(0.2, 0.22, length(f))) * smoothstep(0.17, 0.19, length(f - vec2(0.08, 0.05)));
      s.emit = vec3(0.7, 0.55, 1.0) * moon * 0.8;
    }
    s.spec = 0.3; s.shine = 30.0;
  } else if (mat == 13) {
    float pattern = step(0.7, vnoise(uv * 9.0));
    s.albedo = mix(vec3(0.16, 0.05, 0.1), vec3(0.45, 0.32, 0.18), pattern * 0.5);
  } else if (mat == 14) {
    s.albedo = vec3(0.012, 0.01, 0.012);
    s.spec = 0.8; s.shine = 70.0;
  } else if (mat == 15) {
    // Nakime's eye: one great eye behind the hair.
    vec2 c = (uv - 0.5) * vec2(2.0, 1.0);
    float white = 1.0 - smoothstep(0.42, 0.46, length(c * vec2(1.0, 1.6)));
    float iris = 1.0 - smoothstep(0.2, 0.23, length(c));
    float pupil = 1.0 - smoothstep(0.05, 0.07, length(c));
    vec3 col = mix(vec3(0.9, 0.85, 0.75), vec3(0.8, 0.1, 0.05), iris);
    col = mix(col, vec3(0.0), pupil);
    s.albedo = col * white;
    s.emit = col * white * (0.8 + uPulse * 3.0);
  } else if (mat == 16) {
    s.albedo = vec3(0.6, 0.42, 0.14);
    s.spec = 1.2; s.shine = 80.0;
  } else if (mat == 17) {
    float twist = 0.5 + 0.5 * sin((uv.x + uv.y) * 40.0);
    s.albedo = mix(vec3(0.45, 0.38, 0.2), vec3(0.75, 0.66, 0.4), twist);
  } else if (mat == 18) {
    s.albedo = vec3(0.78, 0.68, 0.62);
  } else if (mat == 19) {
    // Frost: pale blue doors and ice spikes, faintly lit from within.
    float f = fbm(uv * 3.0 + uSeed);
    s.albedo = mix(vec3(0.16, 0.22, 0.28), vec3(0.36, 0.44, 0.5), f);
    s.emit = vec3(0.08, 0.2, 0.32) * (0.2 + 0.4 * f);
    s.spec = 0.5; s.shine = 70.0;
  } else {
    // The moon in Upper One's hall.
    float craters = fbm(uv * vec2(8.0, 4.0));
    s.albedo = vec3(0.8, 0.75, 0.9);
    s.emit = vec3(0.85, 0.8, 1.0) * (1.2 - craters * 0.6);
  }
  return s;
}

void main() {
  vec3 n = normalize(vNormalL);
  if (!gl_FrontFacing) n = -n;
  Surface s = surface(vMat, vUv, vLocal, n);
  vec3 V = normalize(uCamLocal - vLocal);

  // A dim hemisphere: warm from above, a cold glow from the abyss below.
  vec3 nw = normalize(vNormalW);
  vec3 col = s.albedo * mix(vec3(0.012, 0.018, 0.024), vec3(0.03, 0.022, 0.018), nw.y * 0.5 + 0.5);

  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec3 L = uLightPos[i] - vLocal;
    float d2 = dot(L, L);
    float d = sqrt(d2);
    L /= d;
    float fall = uLightPower / (1.0 + d2 * 0.4) * pow(clamp(1.0 - d / 14.0, 0.0, 1.0), 2.0);
    float diff = max(dot(n, L) * 0.8 + 0.2, 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), s.shine) * s.spec;
    vec3 light = uLightCol[i] * fall * flicker(float(i));
    col += light * (s.albedo * diff + spec);
  }

  // The visitor carries a little light of their own.
  vec3 Lc = uCamLocal - vLocal;
  float dc = length(Lc);
  col += s.albedo * vec3(1.0, 0.7, 0.45) * 0.55 * max(dot(n, Lc / dc), 0.0) / (1.0 + dc * dc * 0.35);

  col += s.emit;
  col = applyFog(col, vWorld, cameraPosition);
  gl_FragColor = vec4(col, 1.0);
}
`

/** A sphere around the camera, painted with the fog colours. */
export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

export const skyFragment = /* glsl */ `
precision highp float;
uniform float uTime;
varying vec3 vDir;
${NOISE}
${FOG}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = fogColor(d);
  // Far below, faint embers of rooms beyond counting.
  float below = smoothstep(-0.2, -0.9, d.y);
  vec2 p = d.xz / max(-d.y, 0.05) * 30.0;
  float spark = step(0.985, hash12(floor(p))) * below;
  col += vec3(1.0, 0.45, 0.15) * spark * (0.4 + 0.3 * sin(uTime * 2.0 + hash12(floor(p)) * 30.0)) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`

/**
 * The castle beyond reach: thousands of instanced rooms, some upside
 * down or on their sides, stepping to new places on every strum.
 */
export const farVertex = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aStep;
attribute float aOrient;
attribute float aSeed;
uniform float uStrum;
uniform float uStrumT;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying float vSeed;
${NOISE}
vec3 orient(vec3 p, float o) {
  if (o < 0.5) return p;
  if (o < 1.5) return vec3(p.x, -p.y, -p.z);
  if (o < 2.5) return vec3(p.y, -p.x, p.z);
  if (o < 3.5) return vec3(-p.y, p.x, p.z);
  if (o < 4.5) return vec3(p.x, -p.z, p.y);
  return vec3(p.x, p.z, -p.y);
}
float placed(float k) { return step(0.5, hash11(aSeed * 91.7 + k * 13.3)); }
void main() {
  vec3 p = orient(position, aOrient);
  float t = smoothstep(0.0, 1.0, clamp((uStrumT - 0.5 - hash11(aSeed) * 0.6) / 1.2, 0.0, 1.0));
  float shift = mix(placed(uStrum - 1.0), placed(uStrum), t);
  vec3 w = p + aOffset + aStep * shift;
  vLocal = position;
  vWorld = w;
  vNormalW = orient(normal, aOrient);
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`

export const farFragment = /* glsl */ `
precision highp float;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying float vSeed;
${NOISE}
${FOG}
void main() {
  vec3 col = vec3(0.02, 0.012, 0.008);
  float wall = step(abs(vLocal.y - 1.7), 1.7) * step(abs(vNormalW.y), 0.5);
  // Windows of lit shoji in rows.
  float u = vLocal.x + vLocal.z;
  float win = step(0.25, fract(u / 1.2)) * step(0.6, vLocal.y) * step(vLocal.y, 2.8);
  float lit = step(0.25, hash12(vec2(floor(u / 1.2), vSeed * 77.0)));
  col += vec3(1.0, 0.55, 0.22) * win * lit * wall * (0.9 + 0.1 * sin(uTime * 3.0 + vSeed * 50.0));
  // Roofs catch a little light.
  col += vec3(0.02, 0.02, 0.025) * step(3.4, vLocal.y);
  col = applyFog(col, vWorld, cameraPosition);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Lantern glows scattered on the far castle, and embers drifting near you. */
export const glowVertex = /* glsl */ `
attribute vec3 aStep;
attribute float aSeed;
attribute float aSize;
uniform float uStrum;
uniform float uStrumT;
uniform float uPixel;
uniform float uTime;
varying float vFlicker;
varying vec3 vWorld;
${NOISE}
float placed(float k) { return step(0.5, hash11(aSeed * 91.7 + k * 13.3)); }
void main() {
  float t = smoothstep(0.0, 1.0, clamp((uStrumT - 0.5 - hash11(aSeed) * 0.6) / 1.2, 0.0, 1.0));
  vec3 w = position + aStep * mix(placed(uStrum - 1.0), placed(uStrum), t);
  vWorld = w;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uPixel / max(-mv.z, 1.0), 1.5);
  vFlicker = 0.8 + 0.2 * sin(uTime * (4.0 + aSeed * 3.0) + aSeed * 40.0);
}
`

export const glowFragment = /* glsl */ `
precision highp float;
varying float vFlicker;
varying vec3 vWorld;
${FOG}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  float dist = length(vWorld - cameraPosition);
  float fog = exp(-pow(dist * uFogDensity * 0.55, 1.6));
  gl_FragColor = vec4(vec3(1.0, 0.42, 0.14) * a * a * 2.2 * vFlicker * fog, 1.0);
}
`

export const emberVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixel;
uniform float uFall;
varying float vA;
void main() {
  float box = 36.0;
  vec3 drift = vec3(sin(uTime * 0.3 + aSeed * 9.0) * 0.6, 0.35 + aSeed * 0.4, cos(uTime * 0.21 + aSeed * 5.0) * 0.6);
  vec3 p = position + drift * uTime;
  p.y += uFall * 1.0;
  vec3 rel = mod(p - cameraPosition + box * 0.5, box) - box * 0.5;
  vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.025 + aSeed * 0.045) * uPixel / max(-mv.z, 0.5);
  vA = (1.0 - smoothstep(10.0, 18.0, length(rel))) * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 30.0));
}
`

export const emberFragment = /* glsl */ `
precision highp float;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.2) * a * 1.5, 1.0);
}
`

/**
 * The last pass: the biwa's shockwave ripple, colour fringing, grading
 * (teal shadows, amber highlights), vignette, grain and fades.
 */
export const finalVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const finalFragment = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uPulse;
uniform float uPulseT;
uniform float uFall;
uniform float uBlack;
uniform float uWhite;
uniform float uMotion;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r = length(c * vec2(uResolution.x / uResolution.y, 1.0));
  vec2 dir = c / max(length(c), 1e-4);
  // The strum's shockwave rolls out from the centre.
  float wave = uPulseT * 1.6;
  float ring = exp(-pow((r - wave) * 9.0, 2.0)) * uPulse * uMotion;
  uv -= dir * ring * 0.025;
  float ca = (0.0005 + uPulse * 0.007 * uMotion + uFall * 0.004) * r;
  vec3 col;
  col.r = texture2D(tDiffuse, uv - dir * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv + dir * ca).b;
  // Grade: teal in the shadows, amber in the light.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col * vec3(0.82, 1.0, 1.12), col * vec3(1.08, 0.97, 0.86), smoothstep(0.02, 0.4, l));
  // The strum: a beat of washed-out, ink-and-paper light.
  col = mix(col, vec3(l) * vec3(1.25, 1.05, 0.85), uPulse * 0.4 * exp(-uPulseT * 4.0));
  col += vec3(1.0, 0.6, 0.3) * ring * 0.15;
  float vig = smoothstep(1.05, 0.25, r * (1.0 + uFall * 0.35));
  col *= mix(0.35, 1.0, vig);
  col += (hash(uv * uResolution + fract(uTime) * 100.0) - 0.5) * 0.012 * (0.3 + l * 2.0);
  col = mix(col, vec3(0.0), uBlack);
  col = mix(col, vec3(1.6, 1.4, 1.15), uWhite);
  gl_FragColor = vec4(col, 1.0);
}
`
