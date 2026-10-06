import { TorusKnotGeometry } from 'three'
import { BEAT, easeOut, pulseAt, seededRandom, smooth } from './timeline'

const TAU = Math.PI * 2
const COLORS = ['#ae672e', '#e89848', '#ffc777', '#ffdda0', '#ffead0', '#dae2e6']
type Particle = { a: number; b: number; r: number; x: number; y: number }

/** Analytic 3D projection and vector shading for software-GPU/remote desktops.
 * Nothing is prerecorded: all geometry, light, particles and motion are computed
 * from the same absolute time as the WebGL path. */
export class CanvasUniverse {
  readonly canvas: HTMLCanvasElement
  private readonly c: CanvasRenderingContext2D
  private readonly stars = document.createElement('canvas')
  private readonly glow = document.createElement('canvas')
  private readonly particles: Particle[] = []
  private readonly geometry = new TorusKnotGeometry(1.25, .34, 96, 14, 2, 3)
  private readonly projected = new Float32Array(this.geometry.attributes.position.count * 6)
  private readonly faces: { indices: number[]; depth: number; light: number; rim: number }[] = []
  private width = 1280
  private height = 720

  constructor(before: HTMLCanvasElement) {
    this.canvas = before
    this.c = before.getContext('2d')!
    const random = seededRandom(160128)
    this.stars.width = 1920; this.stars.height = 1080
    const stars = this.stars.getContext('2d')!
    stars.fillStyle = '#030506'; stars.fillRect(0, 0, 1920, 1080)
    for (let i = 0; i < 950; i++) {
      stars.globalAlpha = .12 + random() * .45
      stars.fillStyle = COLORS[i % 6]
      const size = random() > .96 ? 1.8 : .7
      stars.fillRect(random() * 1920, random() * 1080, size, size)
    }
    this.glow.width = this.glow.height = 256
    const light = this.glow.getContext('2d')!
    const gradient = light.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(255,238,185,.95)')
    gradient.addColorStop(.025, 'rgba(255,206,125,.9)')
    gradient.addColorStop(.11, 'rgba(255,136,50,.24)')
    gradient.addColorStop(.4, 'rgba(156,70,12,.08)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    light.fillStyle = gradient; light.fillRect(0, 0, 256, 256)
    const typeCanvas = document.createElement('canvas')
    typeCanvas.width = 1920; typeCanvas.height = 1080
    const type = typeCanvas.getContext('2d')!
    type.fillStyle = '#fff'; type.font = '272px Anton'; type.textAlign = 'center'; type.letterSpacing = '7px'
    type.fillText('GENESIS', 960, 612)
    const pixels = type.getImageData(0, 0, 1920, 1080).data
    const glyph: number[] = []
    for (let y = 350; y < 630; y += 4) for (let x = 160; x < 1760; x += 4) if (pixels[(y * 1920 + x) * 4 + 3] > 128) glyph.push(x, y)
    for (let i = 0; i < 4800; i++) {
      const target = Math.floor(random() * glyph.length / 2) * 2
      this.particles.push({ a: random() * TAU, b: random() * 2 - 1, r: random(), x: glyph[target] + random() * 4 - 2, y: glyph[target + 1] + random() * 4 - 2 })
    }
    for (let u = 0; u < 96; u++) for (let v = 0; v < 14; v++) {
      const first = u * 15 + v
      this.faces.push({ indices: [first, first + 15, first + 16, first + 1], depth: 0, light: 0, rim: 0 })
    }
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.canvas.width = this.width; this.canvas.height = this.height
  }

  render(t: number, poster: boolean, gentle: boolean) {
    const c = this.c
    c.resetTransform(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'
    c.drawImage(this.stars, 0, 0, this.width, this.height)
    c.save(); c.scale(this.width / 1920, this.height / 1080)
    if (t < 7.5) this.blackHole(t, poster)
    else if (t < 15) this.artifact(t, gentle)
    else if (t < 22.5) this.tunnel(t, gentle)
    else this.genesis(t)
    c.restore()
  }

  private halo(x: number, y: number, size: number, alpha = 1) {
    this.c.save(); this.c.globalCompositeOperation = 'lighter'; this.c.globalAlpha = alpha
    this.c.drawImage(this.glow, x - size / 2, y - size / 2, size, size)
    this.c.restore()
  }

  private blackHole(t: number, poster: boolean) {
    const c = this.c
    const r = poster ? 245 : 55 + smooth(0, 7.5, t) * 200
    const cx = 1190, cy = 535
    this.halo(cx, cy, r * 7, .65)
    c.save(); c.translate(cx, cy); c.rotate(-.20)
    const disk = (front: boolean) => {
      c.save(); c.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 80; i++) {
        const spread = i / 80
        const radius = r * (1.12 + spread * 2.20)
        c.strokeStyle = COLORS[i % 5]
        c.globalAlpha = Math.exp(-spread * 3.6) * (.08 + .12 * Math.sin(i * .68 + t * 1.5) ** 2)
        c.lineWidth = 1 + 4 * (1 - spread)
        c.beginPath(); c.ellipse(0, 0, radius, radius * .13, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); c.stroke()
      }
      c.restore()
    }
    disk(false)
    const corona = c.createRadialGradient(0, 0, r * .96, 0, 0, r * 1.2)
    corona.addColorStop(0, '#0000'); corona.addColorStop(.2, '#fff0bbba'); corona.addColorStop(.3, '#ffaf5055'); corona.addColorStop(1, '#db640000')
    c.fillStyle = corona; c.beginPath(); c.arc(0, 0, r * 1.2, 0, TAU); c.fill()
    c.fillStyle = '#010203'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
    c.strokeStyle = '#ffda9c'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, r * 1.017, 0, TAU); c.stroke()
    c.strokeStyle = '#ab723a'; c.lineWidth = .8; c.beginPath(); c.arc(0, 0, r * 1.063, 0, TAU); c.stroke()
    disk(true)
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 220; i++) {
      const p = this.particles[i]
      const radius = r * (1.2 + p.r * 1.9)
      const a = p.a + t * (.22 + (1 - p.r) * .4)
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius * .13
      if (y < 0 && Math.hypot(x, y) < r * 1.04) continue
      c.globalAlpha = .18 + p.r * .3; c.fillStyle = COLORS[i % 5]
      c.fillRect(x, y, 2.2 + p.r * 2, 1)
    }
    c.restore()
    this.halo(cx - r * 1.25, cy + r * .25, r * 2.4, .58)
  }

  private rotate(x: number, y: number, z: number, sx: number, cx: number, sy: number, cy: number, sz: number, cz: number) {
    const a = x * cy + z * sy, b = -x * sy + z * cy
    const d = y * cx - b * sx, e = y * sx + b * cx
    return [a * cz - d * sz, a * sz + d * cz, e]
  }

  private artifact(t: number, gentle: boolean) {
    const c = this.c, x = t - 7.5, beat = pulseAt(t)
    const rx = .45 + x * .38, ry = x * .54, rz = -.25 + x * .17
    const sx = Math.sin(rx), cx = Math.cos(rx), sy = Math.sin(ry), cy = Math.cos(ry), sz = Math.sin(rz), cz = Math.cos(rz)
    const punch = gentle ? 0 : beat * .23
    const distance = 6.5 - punch - (1 - easeOut(x / .75)) * 1.3
    const focal = 1400
    const ox = 1210 + (gentle ? 0 : [0, 45, -35, 18][Math.floor(x / (4 * BEAT))])
    this.halo(ox, 540, 1800, .22)
    const positions = this.geometry.attributes.position.array
    const normals = this.geometry.attributes.normal.array
    const v = this.projected
    for (let i = 0; i < this.geometry.attributes.position.count; i++) {
      const n = i * 3, j = i * 6
      const p = this.rotate(positions[n], positions[n + 1], positions[n + 2], sx, cx, sy, cy, sz, cz)
      const normal = this.rotate(normals[n], normals[n + 1], normals[n + 2], sx, cx, sy, cy, sz, cz)
      const scale = focal / (distance - p[2])
      v[j] = ox + p[0] * scale; v[j + 1] = 540 - p[1] * scale; v[j + 2] = p[2]
      v[j + 3] = normal[0]; v[j + 4] = normal[1]; v[j + 5] = normal[2]
    }
    for (const face of this.faces) {
      const [a, b, d, e] = face.indices.map(index => index * 6)
      face.depth = (v[a + 2] + v[b + 2] + v[d + 2] + v[e + 2]) / 4
      const nx = (v[a + 3] + v[b + 3] + v[d + 3] + v[e + 3]) / 4
      const ny = (v[a + 4] + v[b + 4] + v[d + 4] + v[e + 4]) / 4
      const nz = (v[a + 5] + v[b + 5] + v[d + 5] + v[e + 5]) / 4
      const key = Math.max(0, nx * -.35 + ny * .6 + nz * .72)
      const reflection = Math.max(0, Math.cos(ny * 6.5 + nx * 2.1)) ** 12
      face.light = .06 + key * .42 + reflection * .55
      face.rim = Math.max(0, 1 - Math.abs(nz)) ** 4 * .20
    }
    this.faces.sort((a, b) => a.depth - b.depth)
    c.lineWidth = .6
    for (const face of this.faces) {
      const l = face.light, rim = face.rim
      const red = Math.min(255, Math.round(39 + 213 * l + 70 * rim))
      const green = Math.min(239, Math.round(27 + 178 * l + 15 * rim))
      const blue = Math.min(205, Math.round(16 + 113 * l))
      c.fillStyle = c.strokeStyle = `rgb(${red},${green},${blue})`
      c.beginPath()
      face.indices.forEach((index, i) => { if (i === 0) c.moveTo(v[index * 6], v[index * 6 + 1]); else c.lineTo(v[index * 6], v[index * 6 + 1]) })
      c.closePath(); c.fill(); c.stroke()
    }
    for (let ring = 0; ring < 5; ring++) {
      const tilt = ring * .72 + x * .11, tilt2 = ring * .43 + x * .16
      c.strokeStyle = ring % 2 ? '#bf8b485c' : '#edc0808c'; c.lineWidth = ring ? .9 : 1.6
      c.beginPath()
      for (let i = 0; i <= 120; i++) {
        const a = i / 120 * TAU
        const px = Math.cos(a) * (2.1 + ring * .13), py = Math.sin(a) * (2.1 + ring * .13)
        const p = this.rotate(px, py, 0, Math.sin(tilt), Math.cos(tilt), Math.sin(tilt2), Math.cos(tilt2), 0, 1)
        const k = focal / (distance - p[2])
        if (i === 0) c.moveTo(ox + p[0] * k, 540 - p[1] * k); else c.lineTo(ox + p[0] * k, 540 - p[1] * k)
      }
      c.stroke()
    }
    const release = easeOut((t - 11.25) / 1.2)
    if (release > 0) for (let i = 0; i < 96; i++) {
      const p = this.particles[i], a = p.a + x * .28
      const r = Math.sqrt(1 - p.b * p.b) * (2.3 + p.r * 1.0) * release
      const depth = Math.sin(a) * r, scale = focal / (distance - depth)
      const px = ox + Math.cos(a) * r * scale, py = 540 + p.b * 2.8 * release * scale
      c.save(); c.translate(px, py); c.rotate(a + x); c.globalAlpha = .6 + p.r * .4
      c.fillStyle = COLORS[i % 5]; c.fillRect(-2, -scale * .06, 3 + p.r * 6, scale * .12); c.restore()
    }
  }

  private tunnel(t: number, gentle: boolean) {
    const c = this.c, x = t - 15, beat = gentle ? 0 : pulseAt(t)
    const centerX = 960 + Math.sin(x * .85) * 95, centerY = 540 + Math.cos(x * .7) * 40
    const rotation = x * .17 + Math.sin(x * .9) * .24
    const zoom = 1 + beat * .065
    this.halo(centerX, centerY, 1250, .65)
    const gates = Array.from({ length: 32 }, (_, i) => ({ z: ((i * 2 - x * (9 + x * .3)) % 64 + 64) % 64 + .4 }))
    gates.sort((a, b) => b.z - a.z)
    for (const gate of gates) {
      const radius = 3100 / gate.z * zoom
      const bend = Math.sin(gate.z * .033 + x) * radius * .07
      c.globalAlpha = Math.min(.85, .16 + radius / 1300)
      c.strokeStyle = '#f8b86d'; c.lineWidth = Math.max(.6, radius * .003)
      c.beginPath()
      for (let j = 0; j <= 8; j++) {
        const a = j / 8 * TAU + rotation
        const px = centerX + Math.cos(a) * radius + bend, py = centerY + Math.sin(a) * radius
        if (j === 0) c.moveTo(px, py); else c.lineTo(px, py)
      }
      c.stroke()
    }
    c.globalAlpha = 1
    for (let j = 0; j < 16; j++) {
      const a = j / 16 * TAU + rotation
      c.strokeStyle = j % 2 ? '#7294a83d' : '#eaa66380'; c.lineWidth = j % 2 ? .65 : 1.2
      c.beginPath(); c.moveTo(centerX + Math.cos(a) * 43, centerY + Math.sin(a) * 43)
      c.lineTo(centerX + Math.cos(a) * 1650, centerY + Math.sin(a) * 1650); c.stroke()
    }
    for (let i = 0; i < 170; i++) {
      const p = this.particles[i]
      const z = ((p.r * 70 - x * 13) % 70 + 70) % 70 + .5
      const radius = 2100 / z, a = p.a + rotation
      const streak = 1 + radius * radius * .00012
      c.globalAlpha = Math.min(.8, .15 + radius / 1400); c.strokeStyle = COLORS[i % 6]; c.lineWidth = 1.2
      c.beginPath(); c.moveTo(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius)
      c.lineTo(centerX + Math.cos(a) * (radius + streak), centerY + Math.sin(a) * (radius + streak)); c.stroke()
    }
    c.globalAlpha = 1
  }

  private genesis(t: number) {
    const c = this.c
    if (t < 23.4375) { this.halo(960, 540, 200 * (1 - smooth(22.5, 23.4, t)) + 8, .8); return }
    const e = t - 23.4375, radius = 15 + easeOut(e / 2.2) * 330
    this.halo(960, 540, 1700, .34)
    c.save(); c.translate(960, 540)
    for (let i = 0; i < 18; i++) {
      c.strokeStyle = COLORS[i % 5]; c.globalAlpha = .11 - i * .004
      c.lineWidth = .8; c.beginPath()
      for (let j = 0; j <= 180; j++) {
        const a = j / 180 * TAU
        const r = radius + Math.sin(a * 13 + e * 1.4 + i * .2) * (6 + i * .5) + i * 1.1
        if (j === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      c.stroke()
    }
    c.restore()
    const fade = 1 - smooth(28.15, 29.4, t) * .9
    for (let group = 0; group < 6; group++) {
      c.fillStyle = COLORS[group]
      c.globalAlpha = (.55 + group * .07) * fade
      for (let i = group; i < this.particles.length; i += 6) {
        const p = this.particles[i], a = p.a + e * .13
        const spread = Math.sqrt(1 - p.b * p.b) * (270 + p.r * 1200) * easeOut(e / 2)
        const sx = 960 + Math.cos(a) * spread, sy = 540 + p.b * (200 + p.r * 600) * easeOut(e / 2)
        const morph = smooth(25.5 + p.r * .38, 27.30, t)
        const x = sx + (p.x - sx) * morph, y = sy + (p.y - sy) * morph
        const size = .9 + p.r * 1.5 + morph * .9
        c.fillRect(x, y, size, size)
      }
    }
    c.globalAlpha = 1
  }

  dispose() { this.geometry.dispose() }
}