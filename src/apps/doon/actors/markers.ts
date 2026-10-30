import * as THREE from "three"
import type { Vec2 } from "../geo"

/**
 * The RPG furniture floating over the town: warp crystals turning over
 * their stones, a pillar of gold light standing on the objective, and a
 * bobbing "!" over your friend when she has something to say.
 */

const beaconVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const beaconFragment = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6);
  float band = 0.75 + 0.25 * step(0.5, fract(vUv.y * 14.0 - uTime * 0.8));
  // Quantised, so the light reads as pixels too.
  float a = floor(fade * band * 6.0) / 6.0;
  gl_FragColor = vec4(vec3(1.2, 0.9, 0.4) * a * uAlpha * 0.75, 1.0);
}
`

export class Markers {
  readonly group = new THREE.Group()
  private crystals: { mesh: THREE.Group; base: Vec2; phase: number }[] = []
  private beacon: THREE.Mesh
  private beaconMat: THREE.ShaderMaterial
  private bang = new THREE.Group()
  private materials: THREE.Material[] = []

  constructor(warps: Vec2[]) {
    const crystalMat = new THREE.MeshToonMaterial({ color: 0x8ff4ff, emissive: 0x30c8e0, emissiveIntensity: 1.5 })
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.0, 2.4) })
    this.materials.push(crystalMat, ringMat)
    const gem = new THREE.OctahedronGeometry(0.6, 0)
    gem.scale(1, 1.7, 1)
    const ring = new THREE.TorusGeometry(1.0, 0.04, 4, 16)
    warps.forEach((base, i) => {
      const g = new THREE.Group()
      const m = new THREE.Mesh(gem, crystalMat)
      m.castShadow = true
      const r1 = new THREE.Mesh(ring, ringMat)
      const r2 = new THREE.Mesh(ring, ringMat)
      r1.rotation.x = Math.PI / 2
      r2.rotation.x = Math.PI / 2
      r2.scale.setScalar(0.7)
      g.add(m, r1, r2)
      g.position.set(base[0], 2.2, base[1])
      this.group.add(g)
      this.crystals.push({ mesh: g, base, phase: i * 1.3 })
    })

    this.beaconMat = new THREE.ShaderMaterial({
      vertexShader: beaconVertex,
      fragmentShader: beaconFragment,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const beam = new THREE.CylinderGeometry(0.55, 0.8, 70, 10, 1, true)
    beam.translate(0, 35, 0)
    this.beacon = new THREE.Mesh(beam, this.beaconMat)
    this.beacon.frustumCulled = false
    this.group.add(this.beacon)

    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.4) })
    const dark = new THREE.MeshBasicMaterial({ color: 0x3a2a10 })
    this.materials.push(gold, dark)
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.08), gold)
    stem.position.y = 0.32
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.08), gold)
    dot.position.y = -0.02
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.8, 0.06), dark)
    back.position.set(0, 0.17, -0.05)
    this.bang.add(stem, dot, back)
    this.group.add(this.bang)
  }

  private last = 0

  update(time: number, objective: Vec2 | null, player: Vec2, friend: { p: Vec2; y: number; show: boolean }, camera: THREE.Camera) {
    const dt = Math.min(0.1, Math.max(0, time - this.last))
    this.last = time
    for (const c of this.crystals) {
      c.mesh.position.y = 2.2 + Math.sin(time * 1.6 + c.phase) * 0.25
      c.mesh.children[0].rotation.y = time * 0.9 + c.phase
      c.mesh.children[1].rotation.z = time * 1.4
      c.mesh.children[1].rotation.x = Math.PI / 2 + Math.sin(time + c.phase) * 0.4
      c.mesh.children[2].rotation.z = -time * 2
      c.mesh.children[2].rotation.y = Math.cos(time * 0.8 + c.phase) * 0.5
    }

    // The beam stands on the objective until you're nearly there.
    const d = objective ? Math.hypot(objective[0] - player[0], objective[1] - player[1]) : 0
    const want = objective ? Math.min(1, Math.max(0, (d - 8) / 12)) : 0
    const a = this.beaconMat.uniforms.uAlpha
    a.value += (want - a.value) * Math.min(1, dt * 4)
    this.beaconMat.uniforms.uTime.value = time
    this.beacon.visible = a.value > 0.01
    if (objective) this.beacon.position.set(objective[0], 0, objective[1])

    this.bang.visible = friend.show
    this.bang.position.set(friend.p[0], friend.y + Math.abs(Math.sin(time * 3)) * 0.18, friend.p[1])
    // Always face the camera, like a sprite.
    this.bang.quaternion.copy(camera.quaternion)
  }

  dispose() {
    for (const m of this.materials) m.dispose()
    this.beaconMat.dispose()
  }
}
