import * as THREE from "three"
import { Builder } from "../kit/builder"

/**
 * A blocky little person: legs, arms and head on their own pivots so they
 * can walk, run, sit on a bench and wave. Faces local +z, so a yaw of
 * atan2(dx, dz) points it along (dx, dz).
 */

export type Look = {
  skin: number
  hair: number
  top: number
  /** Second colour on the top (hoodie cuffs, sweater bands). */
  topTrim: number
  legs: number
  shoes: number
  style: "boy" | "girl"
  scarf?: number
  bag?: number
}

export const ME: Look = {
  skin: 0xb9805a,
  hair: 0x17171a,
  top: 0x2a6f73,
  topTrim: 0x1f5558,
  legs: 0x2b3a55,
  shoes: 0xf2f2f2,
  style: "boy",
  bag: 0x8a3b2f,
}

export const FRIEND: Look = {
  skin: 0xd59c74,
  hair: 0x1b1414,
  top: 0xf0e2c8,
  topTrim: 0xd8c4a0,
  legs: 0x3a5a8a,
  shoes: 0xfbf7ef,
  style: "girl",
  scarf: 0x8e1b3a,
  bag: 0xd9a03a,
}

export type Pose = "idle" | "walk" | "run" | "sit" | "wave"

function part(build: (b: Builder) => void, material: THREE.Material) {
  const b = new Builder()
  build(b)
  const mesh = new THREE.Mesh(b.geometry()!, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export class Character {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private head = new THREE.Group()
  private legL = new THREE.Group()
  private legR = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  private phase = 0
  private t = Math.random() * 10
  private look = 0
  private lookTarget = 0
  private lookTimer = 2
  private sit = 0
  private wave = 0
  pose: Pose = "idle"
  /** Ground speed in m/s, for the stride. */
  speed = 0
  /** Smoothed facing. */
  yaw = 0
  targetYaw = 0

  constructor(look: Look, material: THREE.Material) {
    const L = look
    this.root.add(this.body)
    this.body.add(this.head, this.legL, this.legR, this.armL, this.armR)

    // Legs hang from the hips at 0.86 m.
    for (const [leg, x] of [[this.legL, -0.13], [this.legR, 0.13]] as const) {
      leg.position.set(x, 0.86, 0)
      leg.add(
        part((b) => {
          b.box(0, -0.86 + 0.1, 0, 0.21, 0.76, 0.23, L.legs)
          b.box(0, -0.86, 0.05, 0.23, 0.12, 0.34, L.shoes)
        }, material)
      )
    }

    this.body.add(
      part((b) => {
        b.box(0, 0.82, 0, 0.54, 0.66, 0.31, L.top)
        b.box(0, 0.82, 0, 0.56, 0.08, 0.33, L.topTrim)
        if (L.style === "boy") {
          // Hood bunched at the back of the neck, drawstrings.
          b.box(0, 1.36, -0.13, 0.4, 0.14, 0.14, L.topTrim)
          b.box(-0.07, 1.12, 0.16, 0.025, 0.2, 0.02, 0xf2f2f2)
          b.box(0.07, 1.12, 0.16, 0.025, 0.2, 0.02, 0xf2f2f2)
          b.box(0, 0.95, 0.16, 0.3, 0.16, 0.02, L.topTrim)
        } else {
          // A sweater band at the hem.
          b.box(0, 0.86, 0, 0.56, 0.06, 0.33, L.topTrim)
        }
        if (L.scarf) {
          b.box(0, 1.36, 0, 0.36, 0.13, 0.36, L.scarf)
          b.box(0.1, 1.06, 0.17, 0.1, 0.32, 0.05, L.scarf)
        }
        if (L.bag && L.style === "boy") {
          b.box(0, 0.86, -0.25, 0.42, 0.48, 0.18, L.bag)
          b.box(0, 1.25, -0.22, 0.3, 0.08, 0.12, L.bag)
        }
        if (L.bag && L.style === "girl") {
          b.box(0.33, 0.82, 0.02, 0.08, 0.22, 0.24, L.bag)
          b.box(0, 1.2, 0.0, 0.62, 0.03, 0.04, 0x8a5a2b)
        }
        b.box(0, 1.48, 0, 0.13, 0.06, 0.13, L.skin)
      }, material)
    )

    this.head.position.set(0, 1.5, 0)
    this.head.add(
      part((b) => {
        b.box(0, 0, 0, 0.42, 0.42, 0.4, L.skin)
        // Eyes and brows on the front (+z).
        for (const x of [-0.1, 0.1]) {
          b.box(x, 0.17, 0.2, 0.065, 0.075, 0.02, 0x17171a)
          b.box(x, 0.27, 0.2, 0.09, 0.025, 0.02, L.hair)
        }
        b.box(0, 0.06, 0.2, 0.1, 0.02, 0.02, 0x8a4a3a)
        if (L.style === "boy") {
          b.box(0, 0.36, 0, 0.46, 0.13, 0.44, L.hair)
          b.box(0, 0.24, -0.2, 0.46, 0.22, 0.06, L.hair)
          b.box(-0.21, 0.2, 0, 0.05, 0.18, 0.4, L.hair)
          b.box(0.21, 0.2, 0, 0.05, 0.18, 0.4, L.hair)
          b.box(0.06, 0.4, 0.17, 0.2, 0.06, 0.1, L.hair)
          // A short beard along the jaw.
          b.box(0, -0.01, 0.19, 0.4, 0.07, 0.04, 0x2a1e18)
          b.box(-0.19, 0.04, 0.1, 0.05, 0.12, 0.2, 0x2a1e18)
          b.box(0.19, 0.04, 0.1, 0.05, 0.12, 0.2, 0x2a1e18)
        } else {
          b.box(0, 0.36, 0, 0.47, 0.14, 0.45, L.hair)
          b.box(0, 0.3, 0.2, 0.47, 0.06, 0.06, L.hair)
          b.box(-0.22, -0.1, -0.02, 0.06, 0.48, 0.42, L.hair)
          b.box(0.22, -0.1, -0.02, 0.06, 0.48, 0.42, L.hair)
          // Long hair down her back.
          b.box(0, -0.42, -0.21, 0.46, 0.82, 0.08, L.hair)
          b.box(-0.24, 0.12, 0.05, 0.03, 0.05, 0.03, 0xf2c94c)
          b.box(0.24, 0.12, 0.05, 0.03, 0.05, 0.03, 0xf2c94c)
        }
      }, material)
    )

    for (const [arm, x] of [[this.armL, -0.36], [this.armR, 0.36]] as const) {
      arm.position.set(x, 1.4, 0)
      arm.add(
        part((b) => {
          b.box(0, -0.58, 0, 0.16, 0.6, 0.19, L.top)
          b.box(0, -0.62, 0, 0.17, 0.08, 0.2, L.topTrim)
          b.box(0, -0.7, 0, 0.13, 0.12, 0.14, L.skin)
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

    const bob = moving ? Math.abs(Math.sin(this.phase)) * (this.pose === "run" ? 0.09 : 0.045) : Math.sin(this.t * 2) * 0.008
    this.body.position.y = bob - this.sit * 0.38
    this.body.position.z = this.sit * -0.12
    this.body.rotation.x = this.pose === "run" ? 0.16 : 0

    const legSit = -1.45 * this.sit
    this.legL.rotation.x = swing * (1 - this.sit) + legSit
    this.legR.rotation.x = -swing * (1 - this.sit) + legSit
    this.armL.rotation.x = -swing * 0.9 * (1 - this.sit) - this.sit * 0.35
    this.armR.rotation.x = swing * 0.9 * (1 - this.sit) - this.sit * 0.35 - this.wave * 2.7
    this.armR.rotation.z = this.wave * (0.25 + Math.sin(this.t * 10) * 0.3)

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

  /** Turn the head toward a world point (for a moment). */
  glance(yawOffset: number) {
    this.lookTarget = Math.max(-1.1, Math.min(1.1, yawOffset))
    this.lookTimer = 1.2
  }
}
