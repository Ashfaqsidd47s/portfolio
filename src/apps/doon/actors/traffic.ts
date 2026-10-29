import * as THREE from "three"
import { createRng } from "@/os/kernel/rng"
import { along, lengthOf, right, yawOf, type Vec2 } from "../geo"
import { Builder } from "../kit/builder"
import { NoSigns } from "../kit/signs"
import { boxYaw, type Collision } from "../world/collide"
import type { Plan } from "../world/plan"
import { armyTruck, bus, car, scooter, vikram, type Kit } from "../world/props"

/**
 * Vehicles on the roads, keeping left as Dehradun does, turning round at
 * the ends of the map and stopping when someone steps out in front of them.
 */

type Kind = "bus" | "vikram" | "car" | "scooter" | "truck"

const SPEC: Record<Kind, { speed: number; len: number; wid: number }> = {
  bus: { speed: 9, len: 11, wid: 2.6 },
  vikram: { speed: 7, len: 3.8, wid: 1.6 },
  car: { speed: 11, len: 3.8, wid: 1.8 },
  scooter: { speed: 9.5, len: 1.8, wid: 0.6 },
  truck: { speed: 8, len: 7, wid: 2.4 },
}

type Vehicle = {
  kind: Kind
  mesh: THREE.Mesh
  points: Vec2[]
  length: number
  width: number
  s: number
  dir: 1 | -1
  speed: number
  v: number
  shape: ReturnType<typeof boxYaw>
}

export class Traffic {
  readonly group = new THREE.Group()
  private cars: Vehicle[] = []
  private collision: Collision

  constructor(plan: Plan, material: THREE.Material) {
    this.collision = plan.collision
    const r = createRng(99)
    let seed = 1
    for (const route of plan.routes) {
      const road = plan.roads.find((x) => x.id === route.road)
      if (!road) continue
      const length = lengthOf(road.points)
      for (let i = 0; i < route.count; i++) {
        const b = new Builder()
        const k: Kit = { b, s: new Builder(Math.random, true), signs: new NoSigns(), r: createRng(seed++) }
        switch (route.kind) {
          case "bus":
            bus(k, r.pick([0xf3f1ea, 0xf5f5f5, 0xe9e2c9]), r.pick([0x1f5fa8, 0x2e8b57, 0xc0392b]))
            break
          case "vikram":
            vikram(k, r.pick([0x2e7d4f, 0x1f5fa8, 0x2e7d4f]))
            break
          case "car":
            car(k)
            break
          case "scooter":
            scooter(k)
            break
          case "truck":
            armyTruck(k)
            break
        }
        const mesh = new THREE.Mesh(b.geometry()!, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.group.add(mesh)
        const spec = SPEC[route.kind]
        const shape = boxYaw(0, 0, spec.len, spec.wid, 0)
        this.collision.dynamic.push(shape)
        this.cars.push({
          kind: route.kind,
          mesh,
          points: road.points,
          length,
          width: road.width,
          s: r.next() * length,
          dir: r.chance(0.5) ? 1 : -1,
          speed: spec.speed * (0.85 + r.next() * 0.3),
          v: 0,
          shape,
        })
      }
    }
  }

  update(dt: number, people: Vec2[]) {
    for (const c of this.cars) {
      const { p, d } = along(c.points, c.s)
      const fwd: Vec2 = [d[0] * c.dir, d[1] * c.dir]
      // Keep left: the left of travel is minus the right.
      const lane = c.kind === "scooter" ? c.width * 0.36 : c.width * 0.25 + 0.3
      const pos: Vec2 = [p[0] - right(fwd)[0] * lane, p[1] - right(fwd)[1] * lane]

      // Brake for anyone in front, in this lane.
      let block = false
      for (const q of people) {
        const dx = q[0] - pos[0]
        const dz = q[1] - pos[1]
        const ahead = dx * fwd[0] + dz * fwd[1]
        const side = Math.abs(-dx * fwd[1] + dz * fwd[0])
        if (ahead > 0 && ahead < SPEC[c.kind].len / 2 + 6 && side < 2.2) block = true
      }
      const want = block ? 0 : c.speed
      c.v += (want - c.v) * Math.min(1, dt * (block ? 5 : 1.2))
      c.s += c.v * dt * c.dir
      if (c.s > c.length - 2) {
        c.s = c.length - 2
        c.dir = -1
      } else if (c.s < 2) {
        c.s = 2
        c.dir = 1
      }

      const yaw = yawOf(fwd)
      c.mesh.position.set(pos[0], 0.06, pos[1])
      c.mesh.rotation.y = yaw
      const s = c.shape
      s.x = pos[0]
      s.z = pos[1]
      s.ux = Math.cos(yaw)
      s.uz = -Math.sin(yaw)
    }
  }

  dispose() {
    for (const c of this.cars) c.mesh.geometry.dispose()
  }
}
