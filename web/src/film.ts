import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CanvasUniverse } from './canvas-universe'
import { BEAT, CHAPTERS, beatAt, chapterAt, clamp, easeOut, pulseAt, seededRandom, smooth, subtitleAt } from './timeline'
import { backgroundFragment, particleFragment, particleVertex, screenVertex } from './shaders'

const INK = '#eee9dc'
const AMBER = '#ff8b38'

export class Film {
  readonly canvas: HTMLCanvasElement
  readonly renderer: THREE.WebGLRenderer
  readonly ctx: CanvasRenderingContext2D
  readonly gpuName: string
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, .1, 100)
  private readonly scene = new THREE.Scene()
  private readonly background = new THREE.Scene()
  private readonly backgroundCamera = new THREE.Camera()
  private readonly gpuScale: number
  private readonly vectorUniverse: CanvasUniverse | null = null
  private readonly artifact = new THREE.Group()
  // GPU-only resources: every use is after the vectorUniverse early return.
  private readonly knot!: THREE.Mesh
  private readonly fragments!: THREE.InstancedMesh
  private readonly fragmentTransform = new THREE.Object3D()
  private readonly rings: THREE.Mesh[] = []
  private readonly particles!: THREE.Points
  private readonly bgMaterial!: THREE.ShaderMaterial
  private readonly particleMaterial!: THREE.ShaderMaterial
  private readonly environment!: THREE.WebGLRenderTarget
  private width: number
  private height: number
  private time = 0
  gentle = false

  constructor(canvas: HTMLCanvasElement, width = 1920, height = 1080) {
    this.canvas = canvas
    this.width = width
    this.height = height
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!ctx) throw new Error('浏览器无法创建 Canvas 2D。')
    this.ctx = ctx
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
    const gl = this.renderer.getContext()
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    this.gpuName = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2'
    this.gpuScale = /Microsoft|Basic Render|WARP/i.test(this.gpuName) ? .4 : /SwiftShader|llvmpipe/i.test(this.gpuName) ? .67 : 1
    const forceWebGL = new URLSearchParams(location.search).get('renderer') === 'webgl'
    if (!forceWebGL && /SwiftShader|llvmpipe|Microsoft|Basic Render|WARP/i.test(this.gpuName)) {
      this.vectorUniverse = new CanvasUniverse(canvas)
      this.gpuName += ' / Canvas 2D vector path'
      this.resize(width, height)
      return
    }
    this.renderer.domElement.className = 'gpu-film'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    canvas.before(this.renderer.domElement)
    this.renderer.autoClear = false
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width, height, false)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: screenVertex, fragmentShader: backgroundFragment,
      uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uResolution: { value: new THREE.Vector2(width, height) }, uGentle: { value: 0 } },
      depthTest: false, depthWrite: false,
    })
    this.background.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMaterial))

    const generator = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.environment = generator.fromScene(room, .05)
    this.scene.environment = this.environment.texture
    generator.dispose()
    room.dispose()

    const material = new THREE.MeshStandardMaterial({
      color: '#b3823c', metalness: 1, roughness: .23, envMapIntensity: .78,
    })
    const knotGeometry = new THREE.TorusKnotGeometry(1.25, .34, 192, 24, 2, 3)
    this.knot = new THREE.Mesh(knotGeometry, material)
    this.artifact.add(this.knot)
    const wire = new THREE.Mesh(knotGeometry, new THREE.MeshBasicMaterial({ color: '#ffe7bb', wireframe: true, transparent: true, opacity: .052 }))
    wire.scale.setScalar(1.003)
    this.knot.add(wire)
    this.fragments = new THREE.InstancedMesh(new THREE.BoxGeometry(.10, .10, .38), material, 96)
    this.fragments.frustumCulled = false
    this.artifact.add(this.fragments)
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.1 + i * .13, i === 0 ? .014 : .006, 6, 180),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#8f6031' : '#f5c274', transparent: true, opacity: i === 0 ? .9 : .42 }),
      )
      this.rings.push(ring)
      this.artifact.add(ring)
    }
    this.scene.add(this.artifact)
    const key = new THREE.DirectionalLight('#fff1d2', 2.8)
    key.position.set(-3, 4, 5)
    this.scene.add(key)
    const rim = new THREE.PointLight('#ff751f', 22, 30)
    rim.position.set(3, -1, -3)
    this.scene.add(rim)
    const cool = new THREE.DirectionalLight('#a9c9e4', 1.1)
    cool.position.set(4, -2, 2)
    this.scene.add(cool)

    const random = seededRandom(160128)
    const count = 26000
    const seeds = new Float32Array(count * 3)
    for (let i = 0; i < seeds.length; i++) seeds[i] = random()
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
    const lettering = document.createElement('canvas')
    lettering.width = 1920; lettering.height = 1080
    const type = lettering.getContext('2d')!
    type.fillStyle = '#fff'
    type.font = '272px Anton'
    type.textAlign = 'center'
    type.letterSpacing = '7px'
    type.fillText('GENESIS', 960, 612)
    const pixels = type.getImageData(0, 0, 1920, 1080).data
    const glyph: number[] = []
    for (let y = 350; y < 625; y += 5) for (let x = 180; x < 1740; x += 5) {
      if (pixels[(y * 1920 + x) * 4 + 3] > 128) glyph.push(x, y)
    }
    const targets = new Float32Array(count * 3)
    const viewHeight = 16 * Math.tan(21 * Math.PI / 180)
    for (let i = 0; i < count; i++) {
      const sample = Math.floor(random() * glyph.length / 2) * 2
      targets[i * 3] = ((glyph[sample] + random() * 4 - 2) / 1920 - .5) * viewHeight * 16 / 9
      targets[i * 3 + 1] = (.5 - (glyph[sample + 1] + random() * 4 - 2) / 1080) * viewHeight
      targets[i * 3 + 2] = (random() - .5) * .025
    }
    particleGeometry.setAttribute('aGlyph', new THREE.BufferAttribute(targets, 3))
    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertex, fragmentShader: particleFragment,
      uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uHeight: { value: height } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    this.particles = new THREE.Points(particleGeometry, this.particleMaterial)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)

    this.resize(width, height)
  }

  resize(width: number, height: number) {
    if (this.vectorUniverse && width > 1440) { height = Math.round(height * 1440 / width); width = 1440 }
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    if (this.vectorUniverse) { this.vectorUniverse.resize(width, height); return }
    const gpuWidth = Math.round(Math.min(1600, width) * this.gpuScale)
    const gpuHeight = Math.round(gpuWidth * 9 / 16)
    this.renderer.setSize(gpuWidth, gpuHeight, false)
    this.bgMaterial.uniforms.uResolution.value.set(gpuWidth, gpuHeight)
    this.particleMaterial.uniforms.uHeight.value = gpuHeight
  }

  render(time: number, poster = false) {
    const t = poster ? 6.75 : clamp(time, 0, 30)
    this.time = t
    if (this.vectorUniverse) {
      this.vectorUniverse.render(t, poster, this.gentle)
      const ctx = this.ctx
      ctx.resetTransform(); ctx.globalAlpha = 1
      ctx.save(); ctx.scale(this.width / 1920, this.height / 1080)
      this.drawGraphics(t, poster)
      ctx.restore()
      return
    }
    const beat = pulseAt(t)
    const gentle = this.gentle ? .28 : 1
    this.bgMaterial.uniforms.uTime.value = t
    this.bgMaterial.uniforms.uPulse.value = beat * gentle
    this.bgMaterial.uniforms.uGentle.value = this.gentle ? 1 : 0
    this.particleMaterial.uniforms.uTime.value = t
    this.particleMaterial.uniforms.uPulse.value = beat
    this.artifact.visible = t >= 7.5 && t < 15
    this.particles.visible = !poster
    this.camera.up.set(0, 1, 0)
    this.camera.position.set(0, .35, 8)
    this.camera.lookAt(0, 0, 0)
    this.particles.rotation.set(0, 0, 0)
    if (t < 7.5) {
      this.camera.position.set(0, 1.5, 10)
      this.camera.lookAt(0, 0, 0)
      this.particles.rotation.z = -.23
    } else if (t < 15) {
      const x = t - 7.5
      this.artifact.position.set(.68, 0, 0)
      const zoom = (1 - easeOut(x / .75)) * 1.7
      const shot = Math.floor(x / (4 * BEAT))
      this.camera.position.set(Math.sin(x * .24) * .35 + [0, .65, -.55, .25][shot] * gentle, .25 + Math.sin(x * .3) * .25, 7.8 - zoom - beat * .23 * gentle)
      this.camera.lookAt(0, 0, 0)
      this.knot.rotation.set(.45 + x * .38, x * .54, -.25 + x * .17)
      this.knot.scale.setScalar(1 + beat * .015 * gentle)
      const release = easeOut((t - 11.25) / 1.2)
      this.fragments.visible = t >= 11.25
      for (let i = 0; i < 96; i++) {
        const a = i * 2.399963 + x * .26
        const y = 1 - 2 * (i + .5) / 96
        const r = Math.sqrt(1 - y * y)
        const distance = 1.55 + release * (1.0 + (i % 7) * .065) + beat * .09 * gentle
        this.fragmentTransform.position.set(Math.cos(a) * r * distance, y * distance, Math.sin(a) * r * distance)
        this.fragmentTransform.rotation.set(a + x, i * .1 + x, a)
        this.fragmentTransform.scale.setScalar(release * (.6 + (i % 4) * .25))
        this.fragmentTransform.updateMatrix()
        this.fragments.setMatrixAt(i, this.fragmentTransform.matrix)
      }
      this.fragments.instanceMatrix.needsUpdate = true
      this.rings.forEach((ring, i) => ring.rotation.set(x * (.13 + i * .017) + i * .67, x * .14 + i * .6, i * .3))
    } else if (t < 22.5) {
      this.camera.position.set(0, 0, 7)
      this.camera.lookAt(0, 0, -10)
      this.particles.rotation.z = Math.sin((t - 15) * .35) * .25 + (t - 15) * .075
    } else {
      this.camera.position.set(0, 0, 8)
      this.camera.lookAt(0, 0, 0)
    }
    this.renderer.setRenderTarget(null)
    this.renderer.clear()
    this.renderer.render(this.background, this.backgroundCamera)
    this.renderer.clearDepth()
    this.renderer.render(this.scene, this.camera)
    const ctx = this.ctx
    ctx.resetTransform()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.save()
    ctx.scale(this.width / 1920, this.height / 1080)
    this.drawGraphics(t, poster)
    ctx.restore()
  }

  /** Read back pixels only for an explicit QA snapshot, never during playback. */
  snapshot() {
    const composite = document.createElement('canvas')
    composite.width = this.width; composite.height = this.height
    const ctx = composite.getContext('2d')!
    ctx.drawImage(this.vectorUniverse?.canvas ?? this.renderer.domElement, 0, 0, this.width, this.height)
    if (!this.vectorUniverse) ctx.drawImage(this.canvas, 0, 0)
    return composite.toDataURL('image/png')
  }

  private text(text: string, x: number, y: number, size: number, options: { alpha?: number; color?: string; align?: CanvasTextAlign; font?: string; spacing?: number; outline?: boolean } = {}) {
    const c = this.ctx
    c.save()
    c.globalAlpha = options.alpha ?? 1
    c.fillStyle = options.color ?? INK
    c.strokeStyle = options.color ?? INK
    c.font = `${size}px "${options.font ?? 'Anton'}", "Microsoft YaHei", sans-serif`
    c.textAlign = options.align ?? 'left'
    c.textBaseline = 'alphabetic'
    c.letterSpacing = `${options.spacing ?? 0}px`
    const hit = size >= 90 && this.time >= 7.5 && this.time < 22.5 ? pulseAt(this.time) * (this.gentle ? .003 : .016) : 0
    c.translate(x, y)
    c.scale(1 + hit, 1 + hit)
    if (options.outline) { c.lineWidth = 1.3; c.strokeText(text, 0, 0) }
    else c.fillText(text, 0, 0)
    c.restore()
  }

  private line(x1: number, y1: number, x2: number, y2: number, alpha = .3) {
    const c = this.ctx
    c.save()
    c.strokeStyle = INK
    c.globalAlpha = alpha
    c.lineWidth = 1
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke()
    c.restore()
  }

  private drawGraphics(t: number, poster: boolean) {
    const c = this.ctx
    const chapter = CHAPTERS[chapterAt(t)]
    if (poster) {
      const gradient = c.createLinearGradient(0, 0, 1300, 0)
      gradient.addColorStop(0, 'rgba(4,5,6,.60)')
      gradient.addColorStop(1, 'rgba(4,5,6,0)')
      c.fillStyle = gradient; c.fillRect(0, 0, 1920, 1080)
      this.text('A UNIVERSE, WRITTEN IN CODE.', 90, 340, 19, { font: 'IBM Plex Mono', spacing: 4, color: AMBER })
      this.text('GENESIS', 75, 600, 276, { spacing: -5 })
      this.text('一 念 · 万 物', 91, 676, 34, { font: 'Space Grotesk', spacing: 5 })
      this.line(92, 733, 165, 733, .6)
      this.text('FROM NOTHING. TO EVERYTHING.', 188, 740, 16, { font: 'IBM Plex Mono', spacing: 2, alpha: .6 })
      this.text('30 SECONDS / 64 BEATS / ZERO FOOTAGE', 90, 993, 15, { font: 'IBM Plex Mono', spacing: 2, alpha: .5 })
      this.text('001', 1825, 990, 24, { font: 'IBM Plex Mono', align: 'right', alpha: .65 })
      this.drawCross(1819, 88)
      return
    }

    this.text('FRAME ZERO', 76, 72, 17, { font: 'IBM Plex Mono', spacing: 3, alpha: .67 })
    this.text(`${chapter.code} / ${chapter.name}`, 1844, 72, 16, { font: 'IBM Plex Mono', align: 'right', spacing: 2, alpha: .6 })
    this.line(76, 95, 1844, 95, .12)
    this.drawCross(77, 990)
    this.text(`T+ ${t.toFixed(2).padStart(5, '0')}`, 104, 997, 14, { font: 'IBM Plex Mono', alpha: .55 })
    this.text(`${String(beatAt(t) + 1).padStart(2, '0')} / 64`, 1843, 998, 16, { font: 'IBM Plex Mono', align: 'right', alpha: .6 })
    for (let i = 0; i < 64; i++) {
      c.fillStyle = i <= beatAt(t) ? AMBER : '#35332e'
      c.globalAlpha = i <= beatAt(t) ? .75 : .35
      c.fillRect(676 + i * 9, 986, 3, i % 4 === 0 ? 14 : 7)
    }
    c.globalAlpha = 1

    if (t < 3.75) {
      const alpha = smooth(.2, .85, t) * (1 - smooth(3.35, 3.75, t))
      this.text('IN THE', 90, 450, 104, { alpha, spacing: 2 })
      this.text('BEGINNING.', 84, 593, 156, { alpha })
      this.text('THERE WAS NOTHING.', 92, 652, 16, { alpha: alpha * .5, font: 'IBM Plex Mono', spacing: 3 })
      this.annotation(1345, 390, 'SINGULARITY', 'r → 0', alpha * .7)
    } else if (t < 7.5) {
      const local = t - 3.75
      const alpha = easeOut(local / .3) * (1 - smooth(7.1, 7.5, t))
      const offset = (1 - easeOut(local / .55)) * 60
      this.text('ONE', 83, 421 + offset, 176, { alpha })
      this.text('SPARK.', 82, 632 + offset, 228, { alpha })
      this.text('THE FIRST IMPOSSIBLE THING.', 91, 695, 17, { alpha: alpha * .65, font: 'IBM Plex Mono', spacing: 2 })
      this.annotation(1430, 360, 'EVENT HORIZON', 'NO RETURN', alpha * .6)
      if (t > 6.5625) {
        const n = 3 - Math.min(2, Math.floor((t - 6.5625) / (BEAT / 1.5)))
        this.text(`0${n}`, 1840, 908, 108, { align: 'right', color: AMBER, alpha: .85 })
      }
    } else if (t < 11.25) {
      const alpha = easeOut((t - 7.5) / .22)
      this.text('CHAOS', 85, 462, 164, { alpha })
      this.text('TAKES', 91, 570, 104, { alpha: alpha * .65, outline: true })
      this.text('FORM.', 84, 761, 214, { alpha, color: AMBER })
      this.annotation(1460, 770, 'IMPOSSIBLE OBJECT / 001', 'ORDER FROM CHAOS', .65)
    } else if (t < 15) {
      const local = t - 11.25
      this.text('BREAK', 80, 460, 188, { alpha: easeOut(local / .22) })
      this.text('THE', 85, 604, 151, { alpha: easeOut((local - .23) / .22), outline: true })
      this.text('RULES.', 78, 803, 216, { alpha: easeOut((local - .46875) / .25), color: AMBER })
      this.text('REDEFINE WHAT IS POSSIBLE.', 1835, 915, 15, { align: 'right', font: 'IBM Plex Mono', spacing: 2, alpha: .65 })
    } else if (t < 18.75) {
      const local = t - 15
      const alpha = smooth(.18, .45, local) * (1 - smooth(2.65, 3.2, local))
      const scale = 1 + local * .035
      c.save(); c.translate(960, 540); c.scale(scale, scale)
      this.text('FASTER', 0, -7, 230, { align: 'center', alpha, spacing: 5 })
      this.text('THAN THOUGHT.', 0, 112, 96, { align: 'center', alpha: alpha * .9, spacing: 7, outline: true })
      c.restore()
      this.text(`${(1 + local * 7.8).toFixed(2)} c`, 95, 895, 48, { font: 'IBM Plex Mono', color: AMBER })
    } else if (t < 22.5) {
      const local = t - 18.75
      const alpha = smooth(.05, .3, local) * (1 - smooth(3., 3.6, local))
      this.text('NO', 960, 470, 195, { align: 'center', alpha, spacing: 5 })
      this.text('LIMITS.', 960, 708, 270, { align: 'center', alpha, color: INK, spacing: 4 })
      this.text('LEAVE THE KNOWN BEHIND.', 960, 805, 17, { align: 'center', alpha: alpha * .7, font: 'IBM Plex Mono', spacing: 5 })
    } else if (t < 23.4375) {
      this.text('AND THEN—', 960, 704, 18, { align: 'center', font: 'IBM Plex Mono', spacing: 7, alpha: .6 })
    } else if (t < 26.25) {
      const local = t - 23.4375
      const alpha = easeOut(local / .5) * (1 - smooth(25.85, 26.25, t))
      this.text('FROM', 960, 463, 100, { align: 'center', alpha, spacing: 15 })
      this.text('NOTHING.', 960, 662, 221, { align: 'center', alpha, spacing: 2 })
      this.text('TO EVERYTHING.', 960, 754, 27, { align: 'center', alpha: alpha * .8, font: 'IBM Plex Mono', spacing: 8, color: AMBER })
    } else {
      const alpha = smooth(27.35, 28.15, t)
      const spacing = 7
      this.text('GENESIS', 960, 612, 272, { align: 'center', alpha, spacing })
      this.text('一 念 · 万 物', 960, 704, 39, { align: 'center', alpha: easeOut((t - 26.25) / .7), font: 'Space Grotesk', spacing: 7 })
      this.text('NOT A SINGLE FRAME WAS FILMED.', 960, 861, 17, { align: 'center', alpha: alpha * .6, font: 'IBM Plex Mono', spacing: 4 })
      this.line(882, 793, 1038, 793, alpha * .5)
    }

    const subtitle = subtitleAt(t)
    if (subtitle && t < 26.25) this.text(subtitle, 960, 936, 27, { align: 'center', font: 'Space Grotesk', spacing: 3, alpha: .87 })
    const cutPoints = [7.5, 15, 23.4375]
    for (const cut of cutPoints) {
      const delta = t - cut
      if (delta >= 0 && delta < .20) {
        c.globalAlpha = (1 - delta / .2) * (this.gentle ? .035 : .16)
        c.fillStyle = '#ffca8d'; c.fillRect(0, 0, 1920, 1080); c.globalAlpha = 1
      }
    }
    if (t > 29.6) {
      c.fillStyle = '#030405'; c.globalAlpha = smooth(29.6, 30.15, t) * .6
      c.fillRect(0, 0, 1920, 1080); c.globalAlpha = 1
    }
  }

  private drawCross(x: number, y: number) {
    this.line(x - 8, y, x + 8, y, .6)
    this.line(x, y - 8, x, y + 8, .6)
  }

  private annotation(x: number, y: number, title: string, caption: string, alpha: number) {
    this.line(x - 65, y + 55, x - 12, y, alpha * .5)
    this.line(x - 12, y, x + 202, y, alpha * .5)
    this.text(title, x, y - 15, 12, { font: 'IBM Plex Mono', alpha, spacing: 2 })
    this.text(caption, x, y + 25, 11, { font: 'IBM Plex Mono', alpha: alpha * .6, spacing: 2 })
  }

  dispose() {
    if (this.vectorUniverse) { this.vectorUniverse.dispose(); this.renderer.dispose(); return }
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    for (const scene of [this.scene, this.background]) scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    this.environment.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}