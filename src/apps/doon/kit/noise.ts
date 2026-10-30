/** Small deterministic noise for colouring tiles. */

export function hash2(x: number, z: number) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return h - Math.floor(h)
}

/** Value noise in [0, 1], smooth between integer lattice points. */
export function noise2(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash2(xi, zi)
  const b = hash2(xi + 1, zi)
  const c = hash2(xi, zi + 1)
  const d = hash2(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export const fbm2 = (x: number, z: number) => noise2(x, z) * 0.6 + noise2(x * 2.1 + 5.3, z * 2.1 - 1.7) * 0.3 + noise2(x * 4.3, z * 4.3) * 0.1
