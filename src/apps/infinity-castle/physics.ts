/**
 * First-person body physics against axis-aligned boxes, with gravity along
 * any of the six axes — so a room can turn and its wall becomes the floor.
 *
 * The body is a box, tall along "up". It moves one axis at a time (the
 * sideways axes, then up), substepped so a long fall can't tunnel through
 * a floor. It climbs anything up to a stair's rise and snaps down onto the
 * next step when walking downhill, so stairs feel like ramps.
 */

export type Vec3 = [number, number, number]
export type Axis = 0 | 1 | 2
export type Up = { axis: Axis; sign: 1 | -1 }

export type Box = {
  min: Vec3
  max: Vec3
  /** What the box belongs to (a room or passage id), so moving floors carry you. */
  owner: number
}

export const BODY = {
  radius: 0.3,
  halfHeight: 0.875,
  /** Eye above the centre: 1.6 m above the feet. */
  eye: 0.725,
  step: 0.45,
  gravity: 24,
  jump: 7.2,
  terminal: 46,
}

export type Body = {
  /** Centre of the box. */
  pos: Vec3
  vel: Vec3
  up: Up
  grounded: boolean
  /** Owner of the box stood on, or -1. */
  ground: number
}

export type StepResult = {
  /** Speed into the floor at the moment of landing, 0 if there was none. */
  landed: number
  jumped: boolean
}

const EPS = 1e-4

export const upVector = (up: Up): Vec3 => {
  const v: Vec3 = [0, 0, 0]
  v[up.axis] = up.sign
  return v
}

export function halfExtents(up: Up): Vec3 {
  const h: Vec3 = [BODY.radius, BODY.radius, BODY.radius]
  h[up.axis] = BODY.halfHeight
  return h
}

export function createBody(pos: Vec3): Body {
  return { pos: [...pos], vel: [0, 0, 0], up: { axis: 1, sign: 1 }, grounded: false, ground: -1 }
}

function overlaps(pos: Vec3, half: Vec3, b: Box) {
  return (
    pos[0] - half[0] < b.max[0] - EPS &&
    pos[0] + half[0] > b.min[0] + EPS &&
    pos[1] - half[1] < b.max[1] - EPS &&
    pos[1] + half[1] > b.min[1] + EPS &&
    pos[2] - half[2] < b.max[2] - EPS &&
    pos[2] + half[2] > b.min[2] + EPS
  )
}

export function blocked(pos: Vec3, half: Vec3, boxes: readonly Box[]) {
  return boxes.some((b) => overlaps(pos, half, b))
}

/** Moves along one axis and stops at the first box in the way. */
function moveAxis(pos: Vec3, half: Vec3, axis: Axis, delta: number, boxes: readonly Box[]): Box | null {
  if (delta === 0) return null
  pos[axis] += delta
  let hit: Box | null = null
  for (const b of boxes) {
    if (!overlaps(pos, half, b)) continue
    pos[axis] = delta > 0 ? b.min[axis] - half[axis] - EPS : b.max[axis] + half[axis] + EPS
    hit = b
  }
  return hit
}

/** Height of a box's top above the body's feet, measured along up. */
function riseOver(body: Body, half: Vec3, b: Box) {
  const { axis, sign } = body.up
  const top = sign > 0 ? b.max[axis] : -b.min[axis]
  const feet = sign * body.pos[axis] - half[axis]
  return top - feet
}

/**
 * One physics step. `wish` is the velocity the player is asking for, across
 * the floor (its up component is ignored).
 */
export function step(body: Body, boxes: readonly Box[], wish: Vec3, jump: boolean, dt: number): StepResult {
  const { axis: u, sign } = body.up
  const half = halfExtents(body.up)
  const wasGrounded = body.grounded
  const result: StepResult = { landed: 0, jumped: false }

  // Gravity, capped at a falling speed that still feels like falling.
  body.vel[u] -= sign * BODY.gravity * dt
  if (sign * body.vel[u] < -BODY.terminal) body.vel[u] = -sign * BODY.terminal

  // Steering: snappy on the floor, a little in the air.
  const accel = (wasGrounded ? 60 : 14) * dt
  for (let a = 0; a < 3; a++) {
    if (a === u) continue
    const diff = wish[a] - body.vel[a]
    body.vel[a] += Math.max(-accel, Math.min(accel, diff))
  }

  if (jump && wasGrounded) {
    body.vel[u] = sign * BODY.jump
    result.jumped = true
  }

  const speed = Math.max(Math.abs(body.vel[0]), Math.abs(body.vel[1]), Math.abs(body.vel[2])) * dt
  const steps = Math.max(1, Math.ceil(speed / 0.2))
  const h = dt / steps
  body.grounded = false

  for (let s = 0; s < steps; s++) {
    for (let a = 0 as Axis; a < 3; a = (a + 1) as Axis) {
      if (a === u) continue
      const delta = body.vel[a] * h
      const start = body.pos[a]
      const hit = moveAxis(body.pos, half, a, delta, boxes)
      if (!hit) continue
      // Walk up a step rather than stopping at it.
      const rise = riseOver(body, half, hit)
      if ((wasGrounded || s > 0) && rise > 0 && rise <= BODY.step) {
        const lifted: Vec3 = [...body.pos]
        lifted[a] = start + delta
        lifted[u] += sign * (rise + 0.01)
        if (!blocked(lifted, half, boxes)) {
          body.pos[a] = lifted[a]
          body.pos[u] = lifted[u]
          continue
        }
      }
      body.vel[a] = 0
    }

    const vUp = sign * body.vel[u]
    const hit = moveAxis(body.pos, half, u, body.vel[u] * h, boxes)
    if (hit) {
      if (vUp < 0) {
        if (!body.grounded && !wasGrounded) result.landed = Math.max(result.landed, -vUp)
        body.grounded = true
        body.ground = hit.owner
      }
      body.vel[u] = 0
    }
  }

  // Walking downhill: stay on the stairs instead of hopping off each step.
  if (wasGrounded && !body.grounded && !result.jumped && sign * body.vel[u] <= 0) {
    const probe: Vec3 = [...body.pos]
    const hit = moveAxis(probe, half, u, -sign * (BODY.step + 0.05), boxes)
    if (hit) {
      body.pos[u] = probe[u]
      body.grounded = true
      body.ground = hit.owner
      body.vel[u] = 0
    }
  }
  if (!body.grounded) body.ground = -1
  return result
}

/**
 * Pushes the body out of anything it ended up inside — a door slammed on
 * it, or a turn of gravity stood it up across a wall. Shortest way out.
 */
export function depenetrate(body: Body, boxes: readonly Box[]) {
  const half = halfExtents(body.up)
  for (let iter = 0; iter < 6; iter++) {
    let moved = false
    for (const b of boxes) {
      if (!overlaps(body.pos, half, b)) continue
      let best = Infinity
      let axis: Axis = 0
      let push = 0
      for (let a = 0 as Axis; a < 3; a = (a + 1) as Axis) {
        const toMin = body.pos[a] + half[a] - b.min[a]
        const toMax = b.max[a] - (body.pos[a] - half[a])
        if (toMin < best) {
          best = toMin
          axis = a
          push = -toMin - EPS
        }
        if (toMax < best) {
          best = toMax
          axis = a
          push = toMax + EPS
        }
      }
      body.pos[axis] += push
      moved = true
    }
    if (!moved) return
  }
}
