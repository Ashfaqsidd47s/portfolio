import * as THREE from "three"
import { Builder } from "../kit/builder"

/**
 * A chibi adventurer in the style of an isekai anime: a big head with big
 * eyes, spiky or long hair, a cloak or a long coat. Legs, arms, head, and
 * the cloth that trails behind (cape, scarf, long hair) each hang on their
 * own pivot so they can walk, run, sit on a bench, wave and flutter.
 * Faces local +z, so a yaw of atan2(dx, dz) points it along (dx, dz).
 */

export type Look = {
  style: "hero" | "mage"
  skin: number
  hair: number
  hairLight: number
  iris: number
  top: number
  coat: number
  trim: number
  legs: number
  boots: number
  /** Cape (hero) or scarf (mage). */
  cloth: number
  accent: number
}

/** You: a traveller's cloak over a tunic, satchel, a wooden practice sword on the back. */
export const ME: Look = {
  style: "hero",
  skin: 0xd9a27a,
  hair: 0x1c2036,
  hairLight: 0x3c4c86,
  iris: 0x1f8a9a,
  top: 0xf4f1e8,
  coat: 0x2a7f86,
  trim: 0xe0b44a,
  legs: 0x2b2f45,
  boots: 0x5a3a24,
  cloth: 0x1d5a66,
  accent: 0x8a5a2b,
}

/** Your friend: a long maroon coat with gold trim, a cream scarf, a red bow in long hair. */
export const FRIEND: Look = {
  style: "mage",
  skin: 0xf0c4a0,
  hair: 0x3a2420,
  hairLight: 0x6e4438,
  iris: 0xc8781e,
  top: 0xf6eedc,
  coat: 0x8e1b3a,
  trim: 0xe0b44a,
  legs: 0x2b2238,
  boots: 0x4a2a20,
  cloth: 0xf3e6c8,
  accent: 0xd12f4a,
}

export type Pose = "idle" | "walk" | "run" | "sit" | "wave"

const HIP = 0.66
const NECK = 1.12

function part(build: (b: Builder) => void, material: THREE.Material) {
  const b = new Builder()
  build(b)
  const mesh = new THREE.Mesh(b.geometry()!, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Big anime eyes on the face plane z = 0.27: lash line, iris, two catchlights. */
function eyes(b: Builder, L: Look) {
  for (const s of [-1, 1]) {
    const x = s * 0.125
    b.box(x, 0.17, 0.265, 0.12, 0.17, 0.02, 0x1a1420)
    b.box(x, 0.18, 0.272, 0.09, 0.11, 0.02, L.iris)
    b.box(x, 0.17, 0.276, 0.05, 0.05, 0.02, 0x101018)
    b.box(x - s * 0.02, 0.27, 0.28, 0.035, 0.035, 0.02, 0xffffff)
    b.box(x + s * 0.025, 0.19, 0.28, 0.02, 0.02, 0.02, 0xffffff)
    b.box(x + s * 0.01, 0.35, 0.265, 0.12, 0.025, 0.02, L.hair)
    b.box(x + s * 0.06, 0.14, 0.266, 0.06, 0.025, 0.02, 0xf08a8a) // blush
  }
  b.box(0, 0.08, 0.27, 0.06, 0.02, 0.02, 0x9a3a3a)
}

export class Character {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private head = new THREE.Group()
  private legL = new THREE.Group()
  private legR = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  /** Cape, scarf tail or long hair: lifts behind when moving. */
  private cloth = new THREE.Group()
  private hairBack = new THREE.Group()
  private phase = 0
  private t = Math.random() * 10
  private look = 0
  private lookTarget = 0
  private lookTimer = 2
  private sit = 0
  private wave = 0
  private flutter = 0
  pose: Pose = "idle"
  /** Ground speed in m/s, for the stride. */
  speed = 0
  /** Smoothed facing. */
  yaw = 0
  targetYaw = 0

  constructor(look: Look, material: THREE.Material) {
    const L = look
    const hero = L.style === "hero"
    this.root.add(this.body)
    this.body.add(this.head, this.legL, this.legR, this.armL, this.armR, this.cloth)

    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.set(x, HIP, 0)
      leg.add(
        part((b) => {
          b.box(0, -HIP + 0.2, 0, 0.19, HIP - 0.2, 0.21, L.legs)
          b.box(0, -HIP, 0.04, 0.23, 0.26, 0.31, L.boots)
          b.box(0, -HIP + 0.24, 0.0, 0.25, 0.06, 0.27, hero ? 0x7a5234 : L.trim)
        }, material)
      )
    }

    this.body.add(
      part((b) => {
        if (hero) {
          b.box(0, HIP - 0.04, 0, 0.48, NECK - HIP + 0.04, 0.29, L.top)
          // Tunic: two front panels and the back, open at the chest.
          b.box(-0.15, HIP - 0.1, 0.01, 0.2, NECK - HIP, 0.3, L.coat)
          b.box(0.15, HIP - 0.1, 0.01, 0.2, NECK - HIP, 0.3, L.coat)
          b.box(0, HIP - 0.1, -0.02, 0.5, NECK - HIP, 0.28, L.coat)
          b.box(0, HIP - 0.1, 0.01, 0.52, 0.04, 0.32, L.trim)
          b.box(0, HIP + 0.02, 0, 0.53, 0.07, 0.32, L.accent)
          b.box(0, HIP + 0.01, 0.165, 0.09, 0.09, 0.02, L.trim)
          // Satchel on a strap.
          b.box(0.28, HIP - 0.08, 0.04, 0.1, 0.2, 0.22, L.accent)
          b.box(0.05, NECK - 0.32, 0.155, 0.46, 0.04, 0.02, 0x5a3a24)
          // Wooden sword across the back, hilt over the shoulder.
          b.box(-0.12, HIP - 0.05, -0.2, 0.06, 0.62, 0.03, 0xc9b28a)
          b.box(-0.12, HIP + 0.57, -0.2, 0.2, 0.04, 0.05, L.trim)
          b.box(-0.12, HIP + 0.61, -0.2, 0.05, 0.16, 0.05, 0x5a3a24)
          b.box(0, NECK - 0.06, -0.13, 0.4, 0.08, 0.1, L.cloth) // collar
          b.box(0.12, NECK - 0.08, 0.14, 0.07, 0.07, 0.03, L.trim) // clasp
        } else {
          b.box(0, HIP - 0.04, 0, 0.46, NECK - HIP + 0.04, 0.28, L.coat)
          b.box(0, HIP + 0.08, 0.142, 0.14, NECK - HIP - 0.16, 0.02, L.top)
          for (const y of [HIP + 0.16, HIP + 0.28]) b.box(0, y, 0.15, 0.04, 0.04, 0.02, L.trim)
          // The coat flares into a skirt below the waist.
          b.cyl(0, HIP - 0.42, 0, 0.36, 0.25, 0.46, L.coat, 8)
          b.cyl(0, HIP - 0.44, 0, 0.37, 0.37, 0.05, L.trim, 8, false)
          b.box(0, HIP - 0.02, 0, 0.48, 0.06, 0.3, L.trim)
          // Scarf round the neck.
          b.box(0, NECK - 0.1, 0, 0.42, 0.12, 0.34, L.cloth)
          b.box(0.12, NECK - 0.3, 0.16, 0.1, 0.24, 0.04, L.cloth)
        }
        b.box(0, NECK - 0.02, 0, 0.12, 0.05, 0.12, L.skin)
      }, material)
    )

    // What trails behind: a cape from the shoulders, or the scarf's long tail.
    this.cloth.position.set(0, NECK - 0.04, -0.16)
    this.cloth.add(
      part((b) => {
        if (hero) {
          b.box(0, -0.78, 0, 0.56, 0.78, 0.04, L.cloth)
          b.box(0, -0.8, 0, 0.58, 0.05, 0.05, L.trim)
        } else {
          b.box(0.1, -0.5, 0, 0.12, 0.5, 0.03, L.cloth)
          b.box(0.1, -0.52, 0, 0.13, 0.04, 0.04, L.accent)
        }
      }, material)
    )

    this.head.position.set(0, NECK, 0)
    this.head.add(
      part((b) => {
        b.box(0, 0.02, 0, 0.56, 0.54, 0.52, L.skin)
        eyes(b, L)
        b.box(-0.29, 0.18, 0, 0.04, 0.1, 0.08, L.skin) // ears
        b.box(0.29, 0.18, 0, 0.04, 0.1, 0.08, L.skin)
        // Hair cap, sides and back.
        b.box(0, 0.48, 0, 0.62, 0.16, 0.58, L.hair)
        b.box(0, 0.12, -0.27, 0.62, 0.42, 0.1, L.hair)
        b.box(-0.29, 0.22, -0.02, 0.06, 0.32, 0.5, L.hair)
        b.box(0.29, 0.22, -0.02, 0.06, 0.32, 0.5, L.hair)
        // A jagged fringe.
        const fringe = hero ? [0.14, 0.2, 0.12, 0.22, 0.15] : [0.1, 0.16, 0.12, 0.16, 0.1]
        fringe.forEach((h, i) => b.box(-0.24 + i * 0.12, 0.5 - h, 0.27, 0.13, h, 0.06, L.hair))
        b.box(-0.08, 0.51, 0.24, 0.3, 0.03, 0.03, L.hairLight)
        if (hero) {
          // Spikes, and the one strand that never lies flat.
          for (const [x, z, w, h] of [[-0.18, -0.1, 0.22, 0.2], [0.05, -0.05, 0.24, 0.26], [0.2, 0.08, 0.2, 0.18], [-0.1, 0.12, 0.2, 0.16], [0.12, -0.2, 0.22, 0.22]]) {
            b.hip(x, 0.56, z, w, h, w, L.hair)
          }
          b.hip(0.04, 0.8, 0.04, 0.06, 0.18, 0.06, L.hair)
          b.box(0.16, 0.56, 0.0, 0.08, 0.02, 0.3, L.hairLight)
        } else {
          // Side locks framing the face, a red bow, a gold star pin.
          b.box(-0.27, -0.2, 0.18, 0.1, 0.5, 0.1, L.hair)
          b.box(0.27, -0.2, 0.18, 0.1, 0.5, 0.1, L.hair)
          b.box(-0.27, -0.18, 0.235, 0.04, 0.4, 0.02, L.hairLight)
          b.box(0.23, 0.52, 0.16, 0.08, 0.08, 0.04, L.trim)
          b.hip(-0.12, 0.5, -0.3, 0.16, 0.12, 0.08, L.accent)
          b.hip(0.12, 0.5, -0.3, 0.16, 0.12, 0.08, L.accent)
          b.box(0, 0.5, -0.31, 0.08, 0.1, 0.08, L.accent)
        }
      }, material)
    )

    // Long hair (the mage) hangs from the back of the head on its own pivot.
    if (!hero) {
      this.hairBack.position.set(0, 0.3, -0.3)
      this.hairBack.add(
        part((b) => {
          b.box(0, -0.78, 0, 0.5, 0.78, 0.1, L.hair)
          b.box(0, -0.84, 0.0, 0.38, 0.06, 0.09, L.hair)
          b.box(-0.12, -0.5, -0.052, 0.06, 0.42, 0.02, L.hairLight)
        }, material)
      )
      this.head.add(this.hairBack)
    }

    for (const [arm, x] of [[this.armL, -0.31], [this.armR, 0.31]] as const) {
      arm.position.set(x, NECK - 0.06, 0)
      arm.add(
        part((b) => {
          b.box(0, -0.44, 0, 0.14, 0.44, 0.17, hero ? L.top : L.coat)
          b.box(0, -0.46, 0, 0.16, 0.06, 0.19, L.trim)
          b.box(0, -0.55, 0, 0.12, 0.1, 0.13, L.skin)
          if (hero) b.box(0, -0.2, 0, 0.16, 0.2, 0.19, L.coat)
        }, material)
      )
    }
  }

  update(dt: number) {
    this.t += dt
    const moving = this.pose === "walk" || this.pose === "run"
    const amp = this.pose === "run" ? 0.95 : 0.6
    if (moving) this.phase += dt * Math.max(2, this.speed) * (this.pose === "run" ? 1.45 : 2.0)
    const swing = moving ? Math.sin(this.phase) * amp : 0

    // Turn smoothly toward where it's heading.
    let dy = this.targetYaw - this.yaw
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    this.yaw += dy * Math.min(1, dt * 12)
    this.root.rotation.y = this.yaw

    this.sit += ((this.pose === "sit" ? 1 : 0) - this.sit) * Math.min(1, dt * 6)
    this.wave += ((this.pose === "wave" ? 1 : 0) - this.wave) * Math.min(1, dt * 8)

    const bob = moving ? Math.abs(Math.sin(this.phase)) * (this.pose === "run" ? 0.09 : 0.045) : Math.sin(this.t * 2) * 0.01
    this.body.position.y = bob - this.sit * (HIP - 0.5)
    this.body.position.z = this.sit * -0.12
    this.body.rotation.x = this.pose === "run" ? 0.16 : 0

    const legSit = -1.45 * this.sit
    this.legL.rotation.x = swing * (1 - this.sit) + legSit
    this.legR.rotation.x = -swing * (1 - this.sit) + legSit
    this.armL.rotation.x = -swing * 0.9 * (1 - this.sit) - this.sit * 0.35
    this.armR.rotation.x = swing * 0.9 * (1 - this.sit) - this.sit * 0.35 - this.wave * 2.7
    this.armR.rotation.z = this.wave * (0.25 + Math.sin(this.t * 10) * 0.3)

    // Cloth and long hair lift behind with speed and flutter a little.
    const lift = Math.min(1, this.speed / 8.5)
    this.flutter += (lift - this.flutter) * Math.min(1, dt * 4)
    const ripple = Math.sin(this.t * (6 + this.flutter * 8)) * (0.04 + this.flutter * 0.08)
    this.cloth.rotation.x = this.flutter * 1.0 + ripple + this.sit * 0.2 + 0.04
    this.hairBack.rotation.x = this.flutter * 0.55 + ripple * 0.6 + 0.03

    // Idle: look around now and then.
    if (!moving) {
      this.lookTimer -= dt
      if (this.lookTimer <= 0) {
        this.lookTarget = (Math.random() - 0.5) * 1.1
        this.lookTimer = 1.5 + Math.random() * 3
      }
    } else {
      this.lookTarget = 0
    }
    this.look += (this.lookTarget - this.look) * Math.min(1, dt * 4)
    this.head.rotation.y = this.look
    this.head.rotation.x = this.pose === "sit" ? 0.08 : 0
  }
}
