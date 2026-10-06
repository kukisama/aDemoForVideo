import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sample, STAGES, EVENTS, DURATION, BEAT, eventAt } from './timeline.mjs';
import { createFighterSprite } from './sprites.mjs';

// All motion is a function of the score clock. No RAF, dt integration, network
// textures, automatic quality downgrade, or alternate 2D renderer lives here.
const TAU = Math.PI * 2;
const FPS = 24;
const PPU = 48;
const MAX_YAW = Math.PI / 10;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const mix = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const clock = t => clamp(Number.isFinite(t) ? t : 0, 0, DURATION);
const hash = (n, salt = 0) => {
  let x = Math.imul((n + 1) ^ Math.imul(salt + 11, 1597334677), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
function random(seed) { let n = 0; return () => hash(n++, seed); }
const round = v => Math.round(v * 1e6) / 1e6;
const array = v => v.toArray().map(round);
const FULLSCREEN_VERTEX = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

// Six colour + six depth taps: twelve texture fetches in total. Depth rejection prevents
// an in-focus sword from borrowing the distant wall's blur. Focus is in metres
// along camera -Z, not a screen-coordinate vignette or a fake tilt-shift strip.
const DOF_SHADER = {
  name: 'HD2D_DepthAwareDOF_12Fetches',
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1280, 720) },
    cameraNear: { value: .1 }, cameraFar: { value: 90 },
    focusDistance: { value: 8 }, focusRange: { value: 1.15 },
    maxBlur: { value: 6 }, screenFlash: { value: 0 },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse,tDepth;
    uniform vec2 resolution;
    uniform float cameraNear,cameraFar,focusDistance,focusRange,maxBlur,screenFlash;
    float depthAt(vec2 p){
      float d=texture2D(tDepth,p).x;
      return cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear));
    }
    float coc(float z){
      return clamp(max(0.0,abs(z-focusDistance)-focusRange)/max(z,1.0)*2.8,0.0,1.0);
    }
    void main(){
      float z=depthAt(vUv),c=coc(z);
      vec3 col=texture2D(tDiffuse,vUv).rgb*2.0;
      float weights=2.0;
      for(int i=0;i<5;i++){
        float a=float(i)*2.39996323;
        float r=sqrt((float(i)+.5)/5.0);
        vec2 p=clamp(vUv+vec2(cos(a),sin(a))*r*c*maxBlur/resolution,vec2(.001),vec2(.999));
        float dz=depthAt(p);
        float w=1.0;
        if(dz<z-.35)w*=smoothstep(.08,.8,coc(dz));
        if(z<focusDistance-focusRange&&dz>z+1.0)w*=.15;
        col+=texture2D(tDiffuse,p).rgb*w;weights+=w;
      }
      col/=weights;
      col=mix(col,vec3(1.4,.95,.50),min(screenFlash,.09));
      gl_FragColor=vec4(col,1.0);
    }`,
};

class DepthFocusPass extends ShaderPass {
  constructor() { super(DOF_SHADER); this.material.depthTest = false; this.material.depthWrite = false; }
  render(renderer, writeBuffer, readBuffer) {
    if (!readBuffer.depthTexture) throw new Error('HD2D 景深缺少真实 depthTexture。');
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    super.render(renderer, writeBuffer, readBuffer);
  }
  setSize(w, h) { this.uniforms.resolution.value.set(w, h); }
}

function cameraPlan(t, state, poster = false) {
  const index = STAGES.indexOf(state.stage);
  const u = ease((t - state.stage.start) / (state.stage.end - state.stage.start));
  const h = state.hero, r = state.rival;
  const mid = mix(h.x, r.x, .46), air = (h.y + r.y) * .5;
  let p, target, fov = 42, range = 1.05, blur = 6.4;
  switch (index) {
    case 0:
      p = [mix(-2, -1.92, u), mix(1.65, 1.73, u), mix(5, 4.48, u)];
      target = [h.x + .34, h.y + mix(1.60, 1.72, u), 0];
      fov = mix(29, 27, u); range = .62; blur = 7;
      break;
    case 1:
      p = [mix(-.45, .2, u), mix(1.45, 1.3, u), mix(9.7, 8.5, u)];
      target = [mid, 1.23, -.2]; fov = 41;
      break;
    case 2:
      p = [mid + mix(-.65, .18, u), mix(2.15, 1.78, u), mix(8.4, 7.5, u)];
      target = [mid, 1.28, -.15]; fov = 43;
      break;
    case 3:
      p = [mix(.5, 1.1, u), mix(.82, 1.15, u), mix(8.7, 7.8, u)];
      target = [mid, mix(1.02, 1.3, u), -.25]; fov = 44;
      break;
    case 4:
      p = [mid - .8, 1.6 + air * .8 + 1.1 * u, mix(8.8, 10, u)];
      target = [mid, 1.18 + air * .86, -.18]; fov = 44; range = 1.4;
      break;
    case 5:
      p = [mix(.8, -.2, u), mix(2.9, 2.4, u), mix(11, 10, u)];
      target = [mid, 1.2, -.6]; fov = 44; range = 1.3;
      break;
    case 6: {
      const released = ease((t - eventAt('empty-string').time) / .6);
      p = [mix(-1.1, -1.35, u), mix(1.95, 1.86, u) + .2 * released, mix(6.8, 5.9, u) + 3 * released];
      target = [h.x + .58 + 1.65 * released, h.y + 1.57, -.15 - released * .55];
      fov = mix(34, 47, released); range = mix(.70, 1.3, released);
      break;
    }
    default:
      p = [mix(-1.2, 1.5, u), mix(2.65, 5, u), mix(10.2, 16, u)];
      target = [mix(.2, 0, u), mix(1.6, 2, u), mix(-1.1, -7, u)];
      fov = mix(47, 49, u); range = 2.4; blur = 5.3;
  }
  if (poster) {
    p = [-.8, 3.0, 12.5]; target = [-1.7, 2.15, -3]; fov = 47; range = 1.5;
  }
  // Camera azimuth always remains below 18 degrees; billboards rotate only in yaw.
  const yaw = clamp(Math.atan2(p[0] - target[0], p[2] - target[2]), -MAX_YAW, MAX_YAW);
  p[0] = target[0] + Math.tan(yaw) * (p[2] - target[2]);
  return { position: p, target, fov, range, blur, yaw, index };
}

export async function createHD2DScene(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('HD2D 需要 HTMLCanvasElement。');
  const quality = options.quality ?? 'cinematic';
  if (!['cinematic', 'balanced'].includes(quality)) throw new RangeError('quality 只接受 cinematic / balanced；不会自动降级。');
  let width = Math.round(options.width ?? 1280), height = Math.round(options.height ?? 720);
  if (!(width > 0 && height > 0)) throw new RangeError('HD2D 画幅必须大于零。');
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: true, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('HD2D 需要可用的 WebGL2；没有启用软件/二维替代渲染。');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('HD2D HDR 后期需要 WebGL2 EXT_color_buffer_float 支持。');
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1728');
  scene.fog = new THREE.FogExp2('#142839', .026);
  const camera = new THREE.PerspectiveCamera(42, width / height, .1, 90);
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const geo = g => { resources.geometries.add(g); return g; };
  const mat = m => { resources.materials.add(m); return m; };
  const tex = t => { resources.textures.add(t); return t; };
  const groups = {};
  for (const name of ['architecture', 'foreground', 'actors', 'effects', 'atmosphere']) {
    groups[name] = new THREE.Group(); groups[name].name = name; scene.add(groups[name]);
  }
  let disposed = false, lost = false, composer;
  let lastTime = 0, lastReduced = false, lastPoster = false, lastReport = null;
  const passes = [];
  const shaderErrors = [];
  renderer.debug.onShaderError = (context, program, vertex, fragment) => {
    const message = [context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
    shaderErrors.push(message); console.error('HD2D GPU shader error:', message);
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (lastReport) {
      lastReport.render.disposed = true;
      lastReport.render.contextLost = lost;
    }
    canvas.removeEventListener('webglcontextlost', contextLost);
    scene.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.isLight && object.shadow) object.shadow.dispose();
    });
    for (const pass of passes) pass.dispose?.();
    composer?.dispose();
    for (const g of resources.geometries) g.dispose();
    for (const m of resources.materials) m.dispose();
    for (const t of resources.textures) t.dispose();
    renderer.dispose();
    scene.clear();
  }
  function contextLost(event) {
    event.preventDefault(); lost = true; dispose();
    options.onContextLost?.({ message: 'WebGL 上下文已丢失，HD2D GPU 资源已释放；恢复后请重新创建场景。' });
  }
  canvas.addEventListener('webglcontextlost', contextLost, false);
  function assertLive() {
    if (lost) throw new Error('HD2D WebGL 上下文已丢失；请恢复后重新创建场景。');
    if (disposed) throw new Error('HD2D 场景已 dispose。');
  }

  try {
    const rng = random(2106);
    function raster(kind, size = 512) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      const image = ctx.createImageData(size, size), data = image.data;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const large = Math.sin(x * .021 + Math.sin(y * .012) * 3) + Math.cos(y * .026 + x * .004);
        const grain = (hash(x + y * size, 12) - .5) * 22;
        const vein = Math.pow(Math.max(0, Math.sin(x * .037 + y * .009 + Math.sin(y * .039) * 2)), 22) * 18;
        const base = kind === 'floor' ? 55 : 105;
        const value = base + large * 8 + grain - vein;
        data[i] = value * (kind === 'floor' ? .74 : 1.04);
        data[i + 1] = value * (kind === 'floor' ? 1.02 : 1);
        data[i + 2] = value * (kind === 'floor' ? 1.09 : .88);
        data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      // Staggered limestone slabs, irregular widths and quiet seams: no checkerboard.
      for (let row = 0; row < 4; row++) {
        const yy = row * size / 4;
        ctx.fillStyle = 'rgba(3,13,18,.45)'; ctx.fillRect(0, yy, size, 2);
        ctx.fillStyle = 'rgba(211,219,193,.12)'; ctx.fillRect(0, yy + 2, size, 1);
        for (let col = 0; col < 3; col++) {
          const xx = ((col / 3 + (row % 2) / 6) * size) % size;
          ctx.fillStyle = 'rgba(5,12,16,.42)'; ctx.fillRect(xx, yy, 2, size / 4);
          ctx.strokeStyle = 'rgba(4,15,17,.24)'; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(xx + 8, yy + 24); ctx.lineTo(xx + 19, yy + 31); ctx.lineTo(xx + 14, yy + 54); ctx.lineTo(xx + 35, yy + 73); ctx.stroke();
        }
      }
      for (let n = 0; n < 1600; n++) {
        ctx.fillStyle = n % 3 ? 'rgba(9,20,22,.08)' : 'rgba(223,206,145,.10)';
        ctx.fillRect(rng() * size, rng() * size, .5 + rng() * 7, .5 + rng() * 2);
      }
      const texture = tex(new THREE.CanvasTexture(c));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    }
    const stoneMap = raster('stone'), floorMap = raster('floor', 1024);
    floorMap.repeat.set(4, 9); stoneMap.repeat.set(1, 2);
    const stone = mat(new THREE.MeshStandardMaterial({ color: '#9ca397', map: stoneMap, bumpMap: stoneMap, bumpScale: .045, roughness: .88 }));
    const paleStone = mat(new THREE.MeshStandardMaterial({ color: '#bfc3ae', map: stoneMap, bumpMap: stoneMap, bumpScale: .035, roughness: .8 }));
    const darkStone = mat(new THREE.MeshStandardMaterial({ color: '#435f62', map: stoneMap, roughness: .93 }));
    const floorMaterial = mat(new THREE.MeshStandardMaterial({ color: '#8caca5', map: floorMap, bumpMap: floorMap, bumpScale: .026, roughnessMap: floorMap, roughness: .8, metalness: .18 }));
    const bronze = mat(new THREE.MeshStandardMaterial({ color: '#ac7940', metalness: .72, roughness: .37 }));
    const patina = mat(new THREE.MeshStandardMaterial({ color: '#335b59', metalness: .65, roughness: .63 }));
    const gilded = mat(new THREE.MeshStandardMaterial({ color: '#d5ac60', metalness: .76, roughness: .29, emissive: '#765023', emissiveIntensity: .12 }));
    const obsidian = mat(new THREE.MeshStandardMaterial({ color: '#162b35', metalness: .3, roughness: .46 }));
    const doorBlue = mat(new THREE.MeshStandardMaterial({ color: '#164966', metalness: .56, roughness: .32, map: stoneMap }));
    const glowBlue = mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(.25, 1.15, 2.2) }));
    const glowGold = mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.35, .38) }));
    const boxGeometry = geo(new THREE.BoxGeometry(1, 1, 1));
    const cylinderGeometry = geo(new THREE.CylinderGeometry(.47, .60, 1, 24));
    const reedGeometry = geo(new THREE.CylinderGeometry(1, 1, 1, 7));
    const torusGeometry = geo(new THREE.TorusGeometry(1, .045, 7, 64));
    const rubbleGeometry = geo(new THREE.DodecahedronGeometry(1, 0));
    const planeGeometry = geo(new THREE.PlaneGeometry(1, 1));
    const batchMap = new Map(), dummy = new THREE.Object3D();
    function batch(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], group = groups.architecture) {
      const key = `${geometry.uuid}/${material.uuid}/${group.uuid}`;
      if (!batchMap.has(key)) batchMap.set(key, { geometry, material, matrices: [], group });
      dummy.position.set(...position); dummy.rotation.set(...rotation); dummy.scale.set(...scale); dummy.updateMatrix();
      batchMap.get(key).matrices.push(dummy.matrix.clone());
    }
    const block = (material, p, s, r, group) => batch(boxGeometry, material, p, s, r, group);
    const torus = (material, p, s, r = [0, 0, 0]) => batch(torusGeometry, material, p, [s, s, s], r);
    function mesh(geometry, material, parent = groups.architecture) {
      const m = new THREE.Mesh(geometry, material); parent.add(m); return m;
    }
    const floor = mesh(geo(new THREE.PlaneGeometry(19, 36)), floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.035, -8); floor.receiveShadow = true;
    block(darkStone, [0, -.37, -8], [19.6, .65, 36]);
    for (const side of [-1, 1]) {
      block(stone, [side * 8.0, 4.25, -8], [.65, 8.5, 29]);
      block(darkStone, [side * 7.5, .45, -8], [1, .9, 29]);
      block(bronze, [side * 7.08, .95, -8], [.1, .10, 29]);
      block(stone, [side * 5.85, 8.23, -7], [1.1, .65, 29]);
      block(bronze, [side * 5.85, 7.82, -7], [1.25, .09, 29]);
      for (let k = 0; k < 7; k++) {
        const z = 5 - k * 4, x = side * 5.85;
        block(darkStone, [x, .12, z], [1.7, .25, 1.7]);
        block(paleStone, [x, .36, z], [1.42, .24, 1.42]);
        batch(reedGeometry, bronze, [x, .58, z], [.69, .2, .69]);
        batch(cylinderGeometry, stone, [x, 4.0, z], [1, 6.5, 1]);
        for (let flute = 0; flute < 12; flute++) {
          const a = flute * TAU / 12;
          batch(reedGeometry, flute % 3 === 0 ? bronze : paleStone,
            [x + Math.cos(a) * .49, 4.08, z + Math.sin(a) * .49], [.026, 6.12, .026]);
        }
        for (const y of [.79, 1.08, 6.84, 7.14]) torus(bronze, [x, y, z], y < 2 ? .59 : .49, [Math.PI / 2, 0, 0]);
        // Original reed-capital: stepped abacus + paired inward curls, no copied idol.
        block(bronze, [x, 7.28, z], [1.10, .22, 1.1]);
        block(paleStone, [x, 7.52, z], [1.48, .27, 1.48]);
        for (const offset of [-.43, .43]) torus(gilded, [x + offset, 7.27, z + .58], .19);
        for (let glyph = 0; glyph < 4; glyph++) {
          const xx = x - .39 + glyph * .26;
          block(gilded, [xx, 1.44, z + .535], [.025, .48, .025], [0, 0, glyph % 2 ? -.12 : .12]);
          block(gilded, [xx + .045, 1.64, z + .54], [.13, .023, .025]);
        }
        if (side === 1) {
          block(stone, [0, 8.22, z], [12.8, .68, .92]);
          block(bronze, [0, 7.85, z + .49], [12.8, .08, .055]);
          for (let g = 0; g < 22; g++) {
            const xx = -5.75 + g * .55;
            block(gilded, [xx, 8.15, z + .474], [.32, .042, .018]);
            block(gilded, [xx + .14, 8.04, z + .474], [.043, .24, .018]);
          }
        }
        if (k > 0 && k < 6) {
          block(obsidian, [side * 7.62, 4.65, z + 1.7], [.09, 3.25, 1.65]);
          block(glowBlue, [side * 7.55, 5.0, z + 1.7], [.025, 2.3, .08]);
          for (let bar = -1; bar <= 1; bar++) block(bronze, [side * 7.5, 4.65, z + 1.7 + bar * .51], [.14, 3.35, .055]);
        }
      }
      // Roof wings leave a genuine open central light well.
      block(darkStone, [side * 6.25, 8.9, -8], [4.5, .38, 29]);
      for (let z = -20; z < 5; z += 2) block(paleStone, [side * 4.2, 8.85, z], [.32, .48, .22]);
    }
    // Door, broken processional stair and geometric solar pediment.
    block(darkStone, [0, 4.4, -22], [16, 8.8, .85]);
    for (let i = 0; i < 5; i++) {
      block(i % 2 ? stone : paleStone, [0, .08 + i * .145, -16.8 - i * .83], [9.4 - i * .38, .18 + i * .29, 1.15]);
      for (const s of [-1, 1]) batch(rubbleGeometry, darkStone, [s * (4.55 - i * .18), .20 + i * .14, -16.5 - i * .83], [.16, .08, .23], [rng(), rng(), rng()]);
    }
    block(obsidian, [0, 4.02, -21.4], [6.5, 7, .4]);
    for (const s of [-1, 1]) {
      block(doorBlue, [s * 1.47, 4.06, -21.14], [2.83, 6.3, .24]);
      for (const x of [s * .14, s * 2.82]) block(gilded, [x, 4.04, -20.98], [.10, 6.35, .09]);
      for (const y of [1.14, 3.0, 5.1, 7.02]) block(bronze, [s * 1.48, y, -20.98], [2.7, .12, .09]);
      block(paleStone, [s * 3.47, 4.28, -21.0], [.7, 7.5, .9]);
      block(gilded, [s * 3.04, 4.28, -20.52], [.065, 7.5, .05]);
      for (let i = 0; i < 5; i++) {
        torus(bronze, [s * 1.48, 1.52 + i * 1.14, -20.94], .26);
        block(gilded, [s * 1.48, 1.52 + i * 1.14, -20.89], [.035, .37, .035], [0, 0, Math.PI / 4]);
      }
    }
    block(glowBlue, [0, 4, -20.98], [.075, 6.05, .045]);
    block(glowGold, [0, 7.16, -21.03], [5.7, .045, .05]);
    torus(gilded, [0, 5.7, -20.79], .93);
    torus(glowBlue, [0, 5.7, -20.82], .82);
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      block(gilded, [Math.sin(a) * 1.12, 5.7 + Math.cos(a) * 1.12, -20.8], [.045, .22, .05], [0, 0, -a]);
    }
    block(paleStone, [0, 8.0, -21], [8.2, .5, 1.0]);
    const triangle = new THREE.Shape(); triangle.moveTo(-4.2, 0); triangle.lineTo(0, 2.0); triangle.lineTo(4.2, 0); triangle.closePath();
    const pediment = mesh(geo(new THREE.ExtrudeGeometry(triangle, { depth: .44, bevelEnabled: true, bevelSize: .075, bevelThickness: .08, bevelSegments: 1, steps: 1 })), stone);
    pediment.position.set(0, 8.2, -21.3); pediment.castShadow = true;
    for (const s of [-1, 1]) block(gilded, [s * 2.05, 9.18, -20.78], [4.65, .1, .075], [0, 0, -s * .447]);
    torus(bronze, [0, 8.85, -20.79], .47);
    for (const s of [-1, 1]) {
      const flagShape = new THREE.Shape(); flagShape.moveTo(-.58, 0); flagShape.lineTo(.58, 0); flagShape.lineTo(.48, -3.3); flagShape.lineTo(0, -3.0); flagShape.lineTo(-.55, -3.32); flagShape.closePath();
      const flag = mesh(geo(new THREE.ShapeGeometry(flagShape)), mat(new THREE.MeshStandardMaterial({ color: '#183d49', roughness: 1, side: THREE.DoubleSide })));
      flag.position.set(s * 4.5, 7.3, -19.9); flag.rotation.y = -s * .1;
      torus(bronze, [s * 4.5, 6.2, -19.8], .32);
      block(gilded, [s * 4.5, 5.65, -19.76], [.05, 1.14, .02]);
    }
    // Inlaid procession lines and a quiet centre medallion catch the grazing light.
    for (const x of [-3.2, -3.09, 3.09, 3.2]) block(bronze, [x, -.014, -7.6], [.025, .012, 27]);
    for (let i = 0; i < 3; i++) {
      const r = 2.3 + i * .18;
      batch(torusGeometry, i === 1 ? patina : bronze, [0, -.001, -.9], [r, r, .038], [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 20; i++) {
      const a = i * TAU / 20;
      block(bronze, [Math.sin(a) * 2.52, -.002, -.9 + Math.cos(a) * 2.52], [.025, .008, .22], [0, a, 0]);
    }
    // Foreground stones and narrow fern blades are actual occluding geometry.
    for (let i = 0; i < 210; i++) {
      const side = i % 2 ? -1 : 1, z = mix(-19, 6, rng());
      const x = side * mix(4.0, 7.5, rng()), size = .035 + rng() ** 3 * .35;
      batch(rubbleGeometry, i % 4 ? darkStone : stone, [x, size * .26, z], [size * 1.7, size * .55, size], [rng() * 2, rng() * 4, rng()], groups.foreground);
    }
    const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(.23, .35, .05, .88); leafShape.quadraticCurveTo(-.2, .39, 0, 0);
    const leafGeometry = geo(new THREE.ShapeGeometry(leafShape));
    const leafMaterial = mat(new THREE.MeshStandardMaterial({ color: '#173832', roughness: .83, side: THREE.DoubleSide }));
    for (const side of [-1, 1]) for (let plant = 0; plant < 5; plant++) {
      const x = side * (4.4 + rng() * 2), z = 2.7 + rng() * 3;
      for (let stem = 0; stem < 9; stem++) {
        const a = stem * TAU / 9;
        batch(leafGeometry, leafMaterial, [x, .03, z], [.7, .65 + rng() * .75, .7], [-.35, a, .5 * Math.sin(a)], groups.foreground);
        for (let leaf = 0; leaf < 4; leaf++) batch(leafGeometry, leafMaterial, [x + Math.sin(a) * leaf * .09, .12 + leaf * .1, z + Math.cos(a) * leaf * .09], [.33, .32, .33], [-.8, a, .9], groups.foreground);
      }
    }
    scene.add(new THREE.HemisphereLight('#9bb8d0', '#273534', 1.0));
    const moon = new THREE.DirectionalLight('#9bcdf5', 3.0);
    moon.position.set(-3.8, 10.8, 3.2); moon.target.position.set(.1, 0, -5);
    moon.castShadow = true; moon.shadow.mapSize.setScalar(quality === 'cinematic' ? 2048 : 1536);
    Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 13, bottom: -10, near: .5, far: 42 });
    moon.shadow.bias = -.0002; moon.shadow.normalBias = .022;
    // The architecture and moon never move. Rasterize its full-resolution shadow
    // map once instead of resubmitting 1,653 static instances every video frame.
    moon.shadow.autoUpdate = false; moon.shadow.needsUpdate = true;
    scene.add(moon, moon.target);
    const warmKey = new THREE.SpotLight('#ffca83', 95, 25, .67, .65, 1.5);
    warmKey.position.set(-4.8, 5.8, 5.5); warmKey.target.position.set(-.5, 1, 0); scene.add(warmKey, warmKey.target);
    const blueBack = new THREE.PointLight('#3aaaf0', 75, 14, 1.65); blueBack.position.set(0, 4, -19); scene.add(blueBack);
    const slashLight = new THREE.PointLight('#ffca69', 0, 6, 1.7); scene.add(slashLight);
    const fireUniforms = [];
    const fires = [];
    const flameGeometry = geo(new THREE.PlaneGeometry(.72, 1.25));
    function flameMaterial(seed) {
      const material = mat(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, seed: { value: seed } },
        vertexShader: `varying vec2 vUv;uniform float time,seed;
          void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.y*9.0-time*5.0+seed)*uv.y*uv.y*.105;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
        fragmentShader: `varying vec2 vUv;uniform float time,seed;
          void main(){float x=(vUv.x-.5)*2.0,y=vUv.y;
          float width=(1.0-y)*(.55+.12*sin(y*16.0-time*7.0+seed));
          float f=1.0-smoothstep(width*.35,width+.07,abs(x));
          float alpha=f*smoothstep(0.0,.14,y)*(1.0-smoothstep(.68,1.0,y));
          vec3 col=mix(vec3(3.5,.40,.04),vec3(4.2,2.5,.65),f*(1.0-y));
          gl_FragColor=vec4(col,alpha*.72);}`,
      }));
      fireUniforms.push(material.uniforms); return material;
    }
    for (const [x, z] of [[-4.7, 1.4], [4.7, 1.4], [-4.7, -10.4], [4.7, -10.4]]) {
      batch(reedGeometry, bronze, [x, .62, z], [.12, 1.06, .12]);
      batch(reedGeometry, darkStone, [x, .12, z], [.4, .2, .4]);
      for (let rib = 0; rib < 3; rib++) {
        const a = rib * TAU / 3;
        batch(reedGeometry, bronze, [x + Math.cos(a) * .23, .50, z + Math.sin(a) * .23], [.035, .9, .035], [Math.sin(a) * .28, 0, -Math.cos(a) * .28]);
      }
      const bowl = mesh(geo(new THREE.LatheGeometry([new THREE.Vector2(.10, 0), new THREE.Vector2(.22, .04), new THREE.Vector2(.42, .26), new THREE.Vector2(.44, .33), new THREE.Vector2(.37, .34), new THREE.Vector2(.12, .05)], 24)), bronze);
      bowl.position.set(x, 1.04, z); bowl.castShadow = true;
      torus(gilded, [x, 1.35, z], .43, [Math.PI / 2, 0, 0]);
      const seed = fires.length * 3.37;
      for (const yaw of [0, Math.PI / 2]) {
        const flame = mesh(flameGeometry, flameMaterial(seed), groups.atmosphere);
        flame.position.set(x, 1.81, z); flame.rotation.y = yaw;
      }
      const light = new THREE.PointLight('#ffb254', 26, 9, 1.6); light.position.set(x, 1.9, z); scene.add(light);
      fires.push({ x, z, light, seed });
    }
    // Bounded, transparent light shafts: lit air, not an all-screen overlay.
    const shaftGeometry = geo(new THREE.PlaneGeometry(1, 1));
    const shafts = [];
    for (let i = 0; i < 4; i++) {
      const material = mat(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, strength: { value: .033 + i * .003 } },
        vertexShader: FULLSCREEN_VERTEX,
        fragmentShader: `varying vec2 vUv;uniform float time,strength;
          void main(){float edge=pow(max(0.0,sin(vUv.x*3.14159265)),2.0);
          float taper=smoothstep(0.0,.26,vUv.y)*(1.0-smoothstep(.88,1.0,vUv.y));
          float bands=.80+.20*sin(vUv.x*49.0+vUv.y*3.0+time*.15);
          gl_FragColor=vec4(.32,.57,.85,edge*taper*strength*bands);}`,
      }));
      const shaft = mesh(shaftGeometry, material, groups.atmosphere);
      shaft.position.set(-1.1 + i * 1.9, 4.8, -4.8 - i * 4.2); shaft.scale.set(1.4, 9.6, 1); shaft.rotation.z = -.26; shaft.rotation.y = -.08;
      shafts.push(material.uniforms);
    }
    const sky = mesh(geo(new THREE.PlaneGeometry(9, 32)), mat(new THREE.MeshBasicMaterial({ color: '#456983', side: THREE.DoubleSide })), groups.atmosphere);
    sky.rotation.x = Math.PI / 2; sky.position.set(0, 11.5, -8);
    for (const b of batchMap.values()) {
      const object = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
      b.matrices.forEach((matrix, i) => object.setMatrixAt(i, matrix));
      object.castShadow = !b.material.isMeshBasicMaterial;
      object.receiveShadow = true; object.name = `static-${b.group.name}`;
      object.computeBoundingSphere(); b.group.add(object);
    }
    const staticInstanceCount = [...batchMap.values()].reduce((sum, b) => sum + b.matrices.length, 0);
    batchMap.clear();

    // Moving actor silhouettes project onto the actual floor along the moon ray.
    // The room's cached 3D shadow map remains independent of actor pose/history.
    // Nearest filtering applies only to characters, not to the shaded room.
    function spriteTexture(sprite) {
      const texture = tex(new THREE.CanvasTexture(sprite.canvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false; return texture;
    }
    function validateSprite(sprite) {
      if (!sprite?.canvas || sprite.width !== 256 || sprite.height !== 192 || sprite.pixelsPerUnit !== PPU || sprite.origin?.x !== 128 || sprite.origin?.y !== 162 || typeof sprite.draw !== 'function') {
        throw new Error('HD2D sprites.mjs 接口不匹配：需要 256×192、48px/u、脚底原点 (128,162)。');
      }
    }
    const actorGeometry = geo(new THREE.PlaneGeometry(256 / PPU, 192 / PPU));
    const actors = {};
    for (const identity of ['hero', 'rival']) {
      const sprite = createFighterSprite(identity), sampler = createFighterSprite(identity); validateSprite(sprite); validateSprite(sampler);
      const texture = spriteTexture(sprite);
      const material = mat(new THREE.MeshStandardMaterial({
        map: texture, transparent: false, alphaTest: .25, side: THREE.DoubleSide,
        roughness: .95, metalness: 0, emissive: '#354456', emissiveIntensity: .085,
      }));
      const plane = mesh(actorGeometry, material, groups.actors); plane.name = identity;
      plane.castShadow = false; plane.receiveShadow = true;
      const silhouetteMaterial = mat(new THREE.ShaderMaterial({
        uniforms: { map: {value:texture} }, transparent:true, depthWrite:false, side:THREE.DoubleSide,
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;
          vec4 w=modelMatrix*vec4(position,1.0);
          w.xz+=max(0.0,w.y)*vec2(.361111,-.759259);w.y=.015;
          gl_Position=projectionMatrix*viewMatrix*w;}`,
        fragmentShader:`varying vec2 vUv;uniform sampler2D map;void main(){
          float a=texture2D(map,vUv).a;if(a<.25)discard;
          gl_FragColor=vec4(.035,.055,.065,a*.28);}`,
      }));
      const silhouette = mesh(actorGeometry, silhouetteMaterial, groups.effects);
      silhouette.frustumCulled = false; silhouette.name = `${identity}-projected-floor-shadow`;
      const ghosts = [];
      for (let i = 0; i < 3; i++) {
        const art = createFighterSprite(identity), map = spriteTexture(art);
        const material = mat(new THREE.MeshBasicMaterial({ map, color: '#6da8c5', transparent: true, opacity: .15, depthWrite: false, alphaTest: .06, side: THREE.DoubleSide }));
        const ghost = mesh(actorGeometry, material, groups.effects); ghost.visible = false; ghost.name = `${identity}-motion-afterimage-${i}`;
        ghosts.push({ art, map, mesh: ghost, frame: -1, reduced: false });
      }
      actors[identity] = { sprite, sampler, texture, plane, silhouette, ghosts, metadata: null, frame: -1, reduced: false, cache: new Map() };
    }
    const disarmTime = eventAt('weapon-fall').time - .55;
    function spriteState(identity, t, reduced) {
      const body = sample(t, { reduced })[identity];
      // Optional additive actor-state flag. Existing locked pose/motion fields
      // remain untouched; sprites owns removal of the held weapon, not this file.
      return identity === 'rival' && t >= disarmTime ? { ...body, disarmed: true } : body;
    }
    function metadataAt(identity, t, reduced) {
      const actor = actors[identity], frame = Math.floor(clock(t) * FPS + 1e-7);
      const key = frame * 2 + Number(reduced);
      if (!actor.cache.has(key)) {
        const qt = frame / FPS;
        const metadata = actor.sampler.draw(spriteState(identity, qt, reduced), qt);
        if (!metadata?.weaponTip || !metadata.hand) throw new Error(`${identity} sprite.draw() 缺少 weaponTip / hand 元数据。`);
        // Sprite implementations may reuse their arrays; own the cached values.
        actor.cache.set(key, structuredClone(metadata));
      }
      return actor.cache.get(key);
    }
    function yawAt(t, state, poster = false) { return cameraPlan(t, state, poster).yaw; }
    function spritePoint(state, point, yaw, zOffset = 0) {
      const x = (point[0] - 128) / PPU, y = (162 - point[1]) / PPU;
      return new THREE.Vector3(state.x + Math.cos(yaw) * x, state.y + y, state.z - Math.sin(yaw) * x + zOffset);
    }
    function tipAt(identity, t, reduced, poster = false) {
      const s = sample(clock(t), { reduced });
      return spritePoint(s[identity], metadataAt(identity, t, reduced).weaponTip, yawAt(clock(t), s, poster));
    }
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext('2d');
    const shadowGradient = shadowContext.createRadialGradient(64, 64, 5, 64, 64, 62);
    shadowGradient.addColorStop(0, 'rgba(0,0,0,.66)'); shadowGradient.addColorStop(.4, 'rgba(0,0,0,.38)'); shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 128, 128);
    const shadowMap = tex(new THREE.CanvasTexture(shadowCanvas));
    const contactShadows = {};
    for (const identity of ['hero', 'rival']) {
      const contact = mesh(planeGeometry, mat(new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity: .8 })), groups.effects);
      contact.rotation.x = -Math.PI / 2; contactShadows[identity] = contact;
    }
    function updateActors(t, state, plan, reduced) {
      let afterimages = 0;
      for (const identity of ['hero', 'rival']) {
        const actor = actors[identity], body = state[identity], frame = Math.floor(t * FPS + 1e-7);
        if (actor.frame !== frame || actor.reduced !== reduced) {
          const qt = frame / FPS;
          actor.metadata = structuredClone(actor.sprite.draw(spriteState(identity, qt, reduced), qt));
          actor.texture.needsUpdate = true; actor.frame = frame; actor.reduced = reduced;
        }
        actor.plane.position.set(body.x, body.y + (162 - 96) / PPU, body.z);
        actor.plane.rotation.y = plan.yaw; // The sprite has ALREADY mirrored its pixels.
        actor.silhouette.position.copy(actor.plane.position); actor.silhouette.rotation.copy(actor.plane.rotation);
        const contact = contactShadows[identity];
        contact.position.set(body.x, .008, body.z); contact.scale.set(1.05 + body.y * .22, .6 + body.y * .10, 1);
        contact.material.opacity = .76 / (1 + body.y * 1.7);
        const ghosting = [body.pose, body.blend > .5 ? body.nextPose : ''].some(p => p === 'dash' || p === 'airSlash');
        actor.ghosts.forEach((ghost, i) => {
          const ht = t - (i + 1) * 2 / FPS;
          ghost.mesh.visible = ghosting && ht >= 0 && !reduced;
          if (!ghost.mesh.visible) return;
          afterimages++;
          const hs = sample(ht, { reduced }), hf = Math.floor(ht * FPS + 1e-7);
          if (ghost.frame !== hf || ghost.reduced !== reduced) {
            ghost.art.draw(spriteState(identity, hf / FPS, reduced), hf / FPS, { ghost: true });
            ghost.map.needsUpdate = true; ghost.frame = hf; ghost.reduced = reduced;
          }
          ghost.mesh.position.set(hs[identity].x, hs[identity].y + 1.375, hs[identity].z - .018 * (i + 1));
          ghost.mesh.rotation.y = plan.yaw; ghost.mesh.material.opacity = .19 - i * .045;
        });
      }
      return afterimages;
    }

    const RIBBON_SAMPLES = 32;
    const ribbonMaterial = mat(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { opacity: { value: 1 } },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: `varying vec2 vUv;uniform float opacity;
        void main(){float edge=abs(vUv.y-.5)*2.0;
        float core=1.0-smoothstep(.06,.46,edge);
        float alpha=pow(vUv.x,.65)*(1.0-smoothstep(.64,1.0,edge))*opacity;
        gl_FragColor=vec4(mix(vec3(.04,.42,1.25),vec3(2.7,1.42,.35),core),alpha*.82);}`,
    }));
    function dynamicRibbon(samples, material) {
      const positions = new Float32Array(samples * 2 * 3), uvs = new Float32Array(samples * 2 * 2);
      const indices = [];
      for (let i = 0; i < samples; i++) {
        uvs.set([i / (samples - 1), 0, i / (samples - 1), 1], i * 4);
        if (i < samples - 1) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geometry = geo(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(indices);
      const object = mesh(geometry, material, groups.effects); object.frustumCulled = false; object.visible = false;
      return { positions, geometry, mesh: object, samples };
    }
    const trails = { hero: dynamicRibbon(RIBBON_SAMPLES, ribbonMaterial), rival: dynamicRibbon(RIBBON_SAMPLES, ribbonMaterial) };
    for (const trail of Object.values(trails)) {
      trail.history = Array.from({length:10}, () => new THREE.Vector3());
      trail.curve = new THREE.CatmullRomCurve3(trail.history, false, 'centripetal');
      trail.points = Array.from({length:RIBBON_SAMPLES}, () => new THREE.Vector3());
    }
    const trailPoses = new Set(['slash', 'parry', 'uppercut', 'airSlash', 'spin', 'thrust', 'overhead']);
    function updateTrails(t, state, reduced, poster) {
      for (const identity of ['hero', 'rival']) {
        const trail = trails[identity], body = state[identity];
        trail.mesh.visible = (trailPoses.has(body.pose) || (body.blend > .3 && trailPoses.has(body.nextPose))) && t > .05;
        if (!trail.mesh.visible) continue;
        const points = trail.points;
        for (let i = 0; i < trail.history.length; i++) trail.history[i].copy(tipAt(identity, Math.max(0, t - .18 * (1 - i / (trail.history.length - 1))), reduced, poster));
        for (let i = 0; i < RIBBON_SAMPLES; i++) trail.curve.getPoint(i / (RIBBON_SAMPLES - 1), points[i]);
        for (let i = 0; i < RIBBON_SAMPLES; i++) {
          const previous = points[Math.max(0, i - 1)], next = points[Math.min(RIBBON_SAMPLES - 1, i + 1)];
          const dx = next.x - previous.x, dy = next.y - previous.y;
          const len = Math.hypot(dx, dy), w = Math.min(.066, len * .6 + .008) * (.18 + .82 * i / (RIBBON_SAMPLES - 1)) * (reduced ? .5 : 1);
          const nx = len > .0001 ? -dy / len * w : 0, ny = len > .0001 ? dx / len * w : .004;
          const p = points[i];
          trail.positions.set([p.x - nx, p.y - ny, p.z + .014, p.x + nx, p.y + ny, p.z + .014], i * 6);
        }
        trail.geometry.attributes.position.needsUpdate = true;
      }
    }
    // Each event owns a fixed small pool of rings. Positions and fading are
    // re-derived from age; event IDs therefore have visible, seekable feedback.
    const effectRingGeometry = geo(new THREE.TorusGeometry(1, .018, 6, 96));
    const dustRingGeometry = geo(new THREE.RingGeometry(.73, 1, 96));
    const eventPools = EVENTS.map((event, index) => {
      const rings = [];
      const count = ['release', 'resonate'].includes(event.kind) ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const isGround = ['ground', 'land', 'slide', 'dash', 'metal'].includes(event.kind);
        const material = isGround ? mat(new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
          uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color(i ? '#a78e5c' : '#bdad80') } },
          vertexShader: FULLSCREEN_VERTEX,
          fragmentShader: `varying vec2 vUv;uniform float opacity;uniform vec3 tint;
            void main(){float r=length(vUv-.5)*2.0;
            float edge=smoothstep(.72,.84,r)*(1.0-smoothstep(.91,1.0,r));
            float grit=.65+.35*sin(atan(vUv.y-.5,vUv.x-.5)*37.0+r*40.0);
            gl_FragColor=vec4(tint,edge*grit*opacity);}`,
        })) : mat(new THREE.MeshBasicMaterial({ color: i % 2 ? new THREE.Color(.12, .72, 2.0) : new THREE.Color(2.7, 1.6, .44), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const object = mesh(isGround ? dustRingGeometry : effectRingGeometry, material, groups.effects);
        object.visible = false; object.name = `event:${event.id}:${i}`; rings.push(object);
      }
      return { event, index, rings, origins: new Map() };
    });
    function eventOrigin(pool, reduced) {
      if (!pool.origins.has(reduced)) {
        const e = pool.event;
        let origin = new THREE.Vector3(...e.position);
        if (e.kind === 'release' || e.kind === 'pluck') {
          const s = sample(e.time, { reduced });
          const metadata = metadataAt('hero', e.time, reduced);
          origin = spritePoint(s.hero, metadata.offHand ?? metadata.hand, yawAt(e.time, s));
        } else if (e.kind === 'parry') {
          const s = sample(e.time, { reduced }), metadata = metadataAt('hero', e.time, reduced);
          origin = spritePoint(s.hero, metadata.offHand, yawAt(e.time, s), .025);
        } else if (e.kind === 'slash' || e.kind === 'launch') {
          origin = tipAt('hero', e.time, reduced); origin.z += .025;
        } else if (e.kind === 'ground') {
          origin = tipAt('rival', e.time, reduced); origin.y = .025;
        } else if (['land','dash','slide'].includes(e.kind)) {
          const s = sample(e.time, { reduced }); origin.set(s.hero.x, .025, s.hero.z);
        }
        pool.origins.set(reduced, origin);
      }
      return pool.origins.get(reduced);
    }
    const releaseRibbons = [];
    for (let i = 0; i < 3; i++) releaseRibbons.push(dynamicRibbon(20, mat(ribbonMaterial.clone())));
    const sweepMaterial = mat(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { age: { value: -1 }, reduced: { value: 0 } },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: `varying vec2 vUv;uniform float age,reduced;
        void main(){vec2 p=(vUv-.5)*vec2(16.0,27.0);float r=length(p-vec2(-1.4,5.0));
        float front=exp(-pow((r-age*7.0)*2.4,2.0));
        float spoke=pow(max(0.0,cos(atan(p.y-5.0,p.x+1.4)*20.0)),28.0);
        float rings=pow(max(0.0,cos(r*9.0)),24.0);
        float wake=step(r,age*7.0)*exp(-max(0.0,age-r/7.0)*1.7)*(spoke*.28+rings*.2);
        float fade=1.0-smoothstep(3.0,5.3,age);
        gl_FragColor=vec4(mix(vec3(.1,.6,1.7),vec3(2.8,1.7,.44),front),
          (front*.48+wake)*fade*mix(1.0,.65,reduced));}`,
    }));
    const groundSweep = mesh(geo(new THREE.PlaneGeometry(16, 27)), sweepMaterial, groups.effects);
    groundSweep.rotation.x = -Math.PI / 2; groundSweep.position.set(0, .013, -5); groundSweep.visible = false;
    const fallenWeapon = new THREE.Group(); groups.effects.add(fallenWeapon);
    fallenWeapon.name = 'disarmed-ash-spear';
    const ash = mat(new THREE.MeshStandardMaterial({ color: '#816343', roughness: .72 }));
    const silver = mat(new THREE.MeshStandardMaterial({ color: '#b9d3d9', roughness: .3, metalness: .8 }));
    const shaft = mesh(geo(new THREE.CylinderGeometry(.024, .028, 76 / PPU, 8)), ash, fallenWeapon); shaft.position.y = 14 / PPU;
    const spearShape = new THREE.Shape();
    spearShape.moveTo(-3 / PPU, 45 / PPU); spearShape.lineTo(-6 / PPU, 56 / PPU);
    spearShape.lineTo(0, 69 / PPU); spearShape.lineTo(5 / PPU, 56 / PPU); spearShape.lineTo(3 / PPU, 45 / PPU); spearShape.closePath();
    mesh(geo(new THREE.ExtrudeGeometry(spearShape, { depth: .022, bevelEnabled: false, steps: 1 })), silver, fallenWeapon);
    const ferrule = mesh(geo(new THREE.CylinderGeometry(.034, .032, .13, 8)), silver, fallenWeapon); ferrule.position.y = -22 / PPU;
    const collar = mesh(geo(new THREE.CylinderGeometry(.044, .044, .045, 8)), bronze, fallenWeapon); collar.position.y = 43 / PPU;
    fallenWeapon.visible = false;
    const PARTICLE_CAPACITY = 1500;
    const particlePosition = new Float32Array(PARTICLE_CAPACITY * 3), particleColor = new Float32Array(PARTICLE_CAPACITY * 3);
    const particleSize = new Float32Array(PARTICLE_CAPACITY), particleAlpha = new Float32Array(PARTICLE_CAPACITY);
    const particleGeometry = geo(new THREE.BufferGeometry());
    for (const [name, data, itemSize] of [['position', particlePosition, 3], ['color', particleColor, 3], ['size', particleSize, 1], ['alpha', particleAlpha, 1]]) {
      particleGeometry.setAttribute(name, new THREE.BufferAttribute(data, itemSize).setUsage(THREE.DynamicDrawUsage));
    }
    const particleMaterial = mat(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
      uniforms: { height: { value: height } },
      vertexShader: `attribute float size,alpha;varying vec3 vColor;varying float vAlpha;uniform float height;
        void main(){vColor=color;vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*height*projectionMatrix[1][1]/max(.2,-mv.z),1.0,14.0);}`,
      fragmentShader: `varying vec3 vColor;varying float vAlpha;
        void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.0;if(r>1.0)discard;
          float a=(1.0-smoothstep(.08,1.0,r))*vAlpha;
          gl_FragColor=vec4(vColor,a);}`,
    }));
    const particles = new THREE.Points(particleGeometry, particleMaterial); particles.frustumCulled = false; particles.name = 'analytic-sparks-embers-dust'; groups.effects.add(particles);
    const debris = new THREE.InstancedMesh(rubbleGeometry, stone, 96); debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); debris.frustumCulled = false; debris.castShadow = false; debris.receiveShadow = true; debris.count = 0; groups.effects.add(debris);
    let particleCount = 0, debrisCount = 0, activeIDs = [], screenFlashAlpha = 0;
    function particle(x, y, z, size, alpha, r, g, b) {
      if (particleCount >= PARTICLE_CAPACITY || alpha <= .001) return;
      const i = particleCount++;
      particlePosition.set([x, y, z], i * 3); particleColor.set([r, g, b], i * 3); particleSize[i] = size; particleAlpha[i] = alpha;
    }
    function effectLifetime(kind) {
      if (kind === 'release') return 5.8;
      if (kind === 'resonate') return 4.2;
      if (['ground', 'land', 'metal'].includes(kind)) return 1.8;
      return 1.35;
    }
    function updateEffects(t, state, reduced) {
      particleCount = 0; debrisCount = 0; activeIDs = []; screenFlashAlpha = 0;
      const dustCount = reduced ? 150 : quality === 'cinematic' ? 330 : 220;
      for (let i = 0; i < dustCount; i++) {
        const x = mix(-7, 7, hash(i, 1)) + Math.sin(t * .23 + i) * .09;
        const y = .20 + ((hash(i, 2) * 6.7 + t * (.018 + hash(i, 3) * .04)) % 7.0);
        const z = mix(-21, 5, hash(i, 4));
        const flicker = .24 + .22 * Math.sin(t * (.5 + hash(i, 7)) + i * 2.1) ** 2;
        const gold = hash(i, 8) > .65;
        particle(x, y, z, .010 + hash(i, 9) * .021, flicker, gold ? 1.3 : .29, gold ? .78 : .61, gold ? .25 : 1.0);
      }
      for (const fire of fires) {
        for (let i = 0; i < (reduced ? 9 : 23); i++) {
          const life = 1.4 + hash(i, 30) * 1.2;
          const age = (t + hash(i, 22) * life + fire.seed) % life;
          particle(fire.x + Math.sin(age * 3 + i) * age * .13, 1.4 + age * .7, fire.z + Math.cos(i * 4 + age) * age * .11,
            .015, (1 - age / life) * .72, 2.6, .95, .17);
        }
      }
      let maxLight = 0;
      for (const pool of eventPools) {
        const { event: e, index, rings } = pool;
        const age = t - e.time, life = effectLifetime(e.kind), active = age >= 0 && age < life;
        rings.forEach(ring => { ring.visible = active; });
        if (!active) continue;
        activeIDs.push(e.id);
        const origin = eventOrigin(pool, reduced);
        const ground = ['ground', 'land', 'slide', 'dash', 'metal'].includes(e.kind);
        const release = e.kind === 'release', resonance = e.kind === 'resonate';
        const power = e.power * (reduced ? .62 : 1);
        const impulse = Math.exp(-age * (release ? 8 : 17)) * power;
        if (['parry', 'ground', 'launch', 'release'].includes(e.kind)) screenFlashAlpha = Math.max(screenFlashAlpha, impulse * (release ? .068 : .027));
        if (impulse > maxLight) { maxLight = impulse; slashLight.position.copy(origin); }
        rings.forEach((ring, j) => {
          const delayed = age - j * (release ? .042 : resonance ? .13 : .045);
          ring.visible = delayed >= 0;
          if (!ring.visible) return;
          ring.position.copy(origin); ring.rotation.set(0, 0, 0);
          let radius, opacity;
          if (ground) {
            radius = .16 + delayed * (e.kind === 'ground' ? 2.6 : 1.85);
            opacity = .40 * power * Math.exp(-delayed * 1.9);
            ring.rotation.x = -Math.PI / 2; ring.position.y = .019 + j * .018;
            ring.scale.set(radius, radius * (e.kind === 'slide' ? .44 : .85), 1);
            ring.material.uniforms.opacity.value = opacity;
          } else if (release || resonance) {
            radius = release ? .16 + delayed * 1.18 : .9 + delayed * (1.55 + j * .12);
            opacity = power * (release ? .83 * Math.exp(-delayed * 1.5) : .32 * (1 - ease(delayed / life)));
            ring.position.x += release ? delayed * 7.2 : j * .17;
            ring.position.z -= release ? delayed * 2.6 : j * 2.4 + delayed * .9;
            ring.position.y += resonance ? j * .12 : 0;
            ring.rotation.y = release ? 1.14 : .08 + j * .12;
            ring.scale.setScalar(radius); ring.material.opacity = opacity;
          } else {
            radius = .04 + delayed * (e.kind === 'pluck' ? 1.05 : 3.1);
            opacity = power * .8 * Math.exp(-delayed * (e.kind === 'pluck' ? 5 : 10));
            ring.scale.set(radius, radius * (j ? .28 : .83), radius);
            ring.rotation.z = j ? .7 : -.3; ring.material.opacity = opacity;
          }
        });
        const count = reduced ? 18 : ground ? 48 : release || resonance ? 96 : 64;
        for (let i = 0; i < count; i++) {
          const seed = index * 137 + i, a = hash(seed, 51) * TAU;
          const particleLife = ground ? .85 + hash(seed, 52) * .85 : release || resonance ? 1.4 + hash(seed, 52) * 3.4 : .22 + hash(seed, 52) * .72;
          if (age >= particleLife) continue;
          const speed = (ground ? 2.5 : 4.5) * (.18 + hash(seed, 53));
          let px = origin.x + Math.cos(a) * speed * age, py = origin.y + Math.sin(a) * speed * age - 3.4 * age * age;
          let pz = origin.z + (hash(seed, 54) - .5) * speed * age;
          if (ground) py = .06 + Math.abs(Math.sin(a)) * 1.8 * age - 2.1 * age * age;
          if (release || resonance) {
            px = origin.x + age * (release ? 5.0 : .15) + Math.cos(a) * age * 1.5;
            py = origin.y + Math.sin(a) * age * .85 + age * .13;
            pz = origin.z - age * 1.3 + (hash(seed, 57) - .5) * age * 3;
          }
          const alpha = power * Math.pow(1 - age / particleLife, 1.4);
          particle(px, Math.max(.025, py), pz, (ground ? .035 : .019) + hash(seed, 55) * .027, alpha,
            i % 5 ? 3.2 : .19, i % 5 ? 1.60 : .83, i % 5 ? .34 : 2.3);
        }
        if (['ground', 'land', 'slide'].includes(e.kind)) {
          for (let i = 0; i < 26 && debrisCount < 96; i++) {
            const seed = index * 61 + i, a = hash(seed, 70) * TAU;
            const speed = .45 + hash(seed, 71) * 2.8, vy = .7 + hash(seed, 72) * 2.5;
            const flight = vy / 4.9, flightAge = Math.min(age, flight);
            const y = Math.max(0, vy * flightAge - 4.9 * flightAge * flightAge);
            const size = (.023 + hash(seed, 73) * .08) * (1 - ease((age - 1.15) / .65));
            const direction = e.kind === 'ground' ? -.8 : e.kind === 'slide' ? .65 : .12;
            dummy.position.set(origin.x + (Math.cos(a) * speed + direction) * age, .025 + y, origin.z + Math.sin(a) * speed * age * .65);
            dummy.rotation.set(seed + flightAge * 7, seed * .13, flightAge * 9);
            dummy.scale.set(size * 1.4, size, size * .8); dummy.updateMatrix(); debris.setMatrixAt(debrisCount++, dummy.matrix);
          }
        }
      }
      slashLight.intensity = maxLight * 18;
      debris.count = debrisCount; debris.instanceMatrix.needsUpdate = true;
      particleGeometry.setDrawRange(0, particleCount);
      for (const attribute of Object.values(particleGeometry.attributes)) attribute.needsUpdate = true;
      const releasePool = eventPools.find(p => p.event.kind === 'release');
      const age = t - releasePool.event.time;
      const origin = eventOrigin(releasePool, reduced);
      releaseRibbons.forEach((ribbon, j) => {
        const a = age - j * .024;
        ribbon.mesh.visible = a >= 0 && a < .58;
        if (!ribbon.mesh.visible) return;
        ribbon.mesh.material.uniforms.opacity.value = (1 - a / .58) * (reduced ? .4 : .82);
        for (let i = 0; i < ribbon.samples; i++) {
          const u = i / (ribbon.samples - 1), len = .3 + a * 15;
          const x = origin.x + u * len, z = origin.z - u * len * .32;
          const y = origin.y + Math.sin(u * Math.PI) * (j - 1) * (.22 + a * .4) + Math.sin(u * 12 - a * 9) * .024;
          const w = Math.sin(u * Math.PI) * (.009 + (1 - a / .58) * .035);
          ribbon.positions.set([x, y - w, z, x, y + w, z], i * 6);
        }
        ribbon.geometry.attributes.position.needsUpdate = true;
      });
      groundSweep.visible = age >= 0 && age < 5.8;
      sweepMaterial.uniforms.age.value = age; sweepMaterial.uniforms.reduced.value = Number(reduced);
      const metalAge = t - eventAt('weapon-fall').time;
      fallenWeapon.visible = t >= disarmTime;
      if (fallenWeapon.visible) {
        const e = eventAt('weapon-fall');
        if (metalAge < 0) {
          const s = sample(disarmTime, { reduced }), m = metadataAt('rival', disarmTime - 1 / FPS, reduced);
          const grip = spritePoint(s.rival, m.hand, yawAt(disarmTime, s));
          const u = clamp((t - disarmTime) / .55);
          fallenWeapon.position.set(mix(grip.x, e.position[0], u), mix(grip.y, .09, u) + Math.sin(u * Math.PI) * .28, mix(grip.z, e.position[2], u));
          const angle = -Math.atan2(m.weaponTip[0] - m.hand[0], m.hand[1] - m.weaponTip[1]);
          fallenWeapon.rotation.set(u * Math.PI / 2, yawAt(disarmTime, s) * (1 - u), mix(angle, -.38, u));
        } else {
          const a = Math.min(metalAge, .7);
          fallenWeapon.position.set(e.position[0] + a * .32, .09 + Math.abs(Math.sin(a / .7 * Math.PI)) * .25 * (1 - a / .7), e.position[2]);
          fallenWeapon.rotation.set(Math.PI / 2, 0, -.38 + a * 2.3);
        }
      }
      if (reduced) screenFlashAlpha = 0;
    }

    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
    composer = new EffectComposer(renderer, target);
    // Both ping-pong targets need depth: RenderPass may start in either one.
    if (!composer.renderTarget2.depthTexture) composer.renderTarget2.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    const renderPass = new RenderPass(scene, camera);
    const dof = new DepthFocusPass();
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), .39, .48, 1.22);
    const smaa = new SMAAPass();
    const output = new OutputPass();
    passes.push(renderPass, dof, bloom, smaa, output);
    passes.forEach(pass => composer.addPass(pass));
    // These are embedded data-URI LUTs, never a network asset. Awaiting them makes
    // draw(0), seek and the very first snapshot use exactly the same AA pipeline.
    for (const texture of [smaa._areaTexture, smaa._searchTexture]) {
      const image = texture?.image;
      if (image?.decode) { await image.decode(); texture.needsUpdate = true; }
    }
    const focusPoint = new THREE.Vector3(), viewPoint = new THREE.Vector3();
    const actualTarget = new THREE.Vector3();
    function focusFor(plan, state) {
      const p = new THREE.Vector3(...plan.position), aim = new THREE.Vector3(...plan.target);
      const forward = aim.clone().sub(p).normalize();
      // Rack from the hand/eye to the travelling wave, then into the hall; actors
      // retain a ±range sharp zone during contacts and airborne crossing.
      let point = new THREE.Vector3(mix(state.hero.x, state.rival.x, .45), 1.35 + (state.hero.y + state.rival.y) * .4, 0);
      if (plan.index === 0 || plan.index === 6) point.set(state.hero.x + .45, state.hero.y + 1.55, 0);
      if (plan.index === 7) point.set(.3, 1.6, mix(-.1, -5.0, ease((state.t - STAGES[7].start) / 3.75)));
      return { point, distance: Math.max(.3, point.clone().sub(p).dot(forward)) };
    }
    function jitter(t, reduced) {
      if (reduced) return [0, 0];
      let a = 0;
      for (const e of EVENTS) {
        const age = t - e.time;
        if (age >= 0 && age < .25 && ['parry', 'ground', 'launch', 'land', 'release'].includes(e.kind)) a = Math.max(a, e.power * .024 * Math.exp(-age * 19));
      }
      return [Math.sin(t * 149.1) * a, Math.cos(t * 173.3) * a * .68];
    }
    function objectCounts() {
      let meshes = 0, instancedMeshes = 0, lights = 0, objects = 0;
      scene.traverse(o => { objects++; if (o.isMesh) meshes++; if (o.isInstancedMesh) instancedMeshes++; if (o.isLight) lights++; });
      return {
        objects, meshes, instancedMeshes, staticInstances: staticInstanceCount, lights,
        geometries: resources.geometries.size, materials: resources.materials.size, textures: resources.textures.size,
        gpuGeometries: renderer.info.memory.geometries, gpuTextures: renderer.info.memory.textures,
        particleCapacity: PARTICLE_CAPACITY, debrisCapacity: 96,
      };
    }
    function report(t, state, plan, reduced, poster, stats = null) {
      const focus = focusFor(plan, state);
      const actorReport = identity => {
        const body = state[identity], metadata = metadataAt(identity, t, reduced);
        return {
          ...body, frame: Math.floor(t * FPS + 1e-7), displayedPose: metadata.pose,
          displayedPhase: metadata.phase, poseSignature: metadata.poseSignature,
          weaponTip: array(spritePoint(body, metadata.weaponTip, plan.yaw)),
          hand: array(spritePoint(body, metadata.hand, plan.yaw)), offHand: array(spritePoint(body, metadata.offHand, plan.yaw)), billboardYaw: plan.yaw,
        };
      };
      const active = EVENTS.filter(e => t >= e.time && t < e.time + effectLifetime(e.kind)).map(e => e.id);
      const rivalMetadata = metadataAt('rival', t, reduced);
      const disarmed = t >= disarmTime;
      const heldWeaponHidden = disarmed && (rivalMetadata.weaponHidden === true || ['none', 'unarmed'].includes(rivalMetadata.weapon));
      return {
        t, requestedTime: lastTime, duration: DURATION, stage: { ...state.stage, index: plan.index },
        hero: actorReport('hero'), rival: actorReport('rival'), hitStopped: state.hitStopped,
        camera: {
          position: stats ? array(camera.position) : plan.position, target: plan.target, fov: plan.fov,
          yaw: plan.yaw, yawLimit: MAX_YAW,
          focus: { distance: round(stats ? dof.uniforms.focusDistance.value : focus.distance), target: array(focus.point), range: plan.range, maxBlurPx: plan.blur * height / 720, depthSource: 'WebGL2 DepthTexture / perspective linearization', colorTaps: 6, depthTaps: 6, totalTextureFetches: 12 },
        },
        render: {
          webgl: true, version: 2, renderer: gpuName, quality, dpr: 1, width, height,
          drawCalls: stats?.calls ?? null, triangles: stats?.triangles ?? null, points: stats?.points ?? null,
          statisticsTime: stats ? t : null, postprocessing: ['RenderPass', 'DepthAwareDoF(6 color + 6 depth)', 'UnrealBloomPass', 'SMAAPass', 'OutputPass(ACES + sRGB)'],
          preserveDrawingBuffer: true, softwareFallback: false, shaderErrors: [...shaderErrors], disposed, contextLost: lost,
        },
        effects: {
          active: active, particleCount: stats ? particleCount : null, debrisCount: stats ? debrisCount : null,
          afterimages: stats ? stats.afterimages : null, screenFlashAlpha: stats ? screenFlashAlpha : 0,
          afterimagePurpose: '2/4/6-frame motion history only during dash / airSlash',
          trailSource: 'sprite.weaponTip, 0.18s absolute-time history, quantized 24fps poses',
          particleMotion: 'fixed seed / analytic age / fixed buffers',
          eventOrigins: eventPools.map(pool => ({id:pool.event.id,position:array(eventOrigin(pool,reduced)),binding:['parry','release','pluck'].includes(pool.event.kind)?'hero.offHand':['slash','launch'].includes(pool.event.kind)?'hero.weaponTip':['land','dash','slide'].includes(pool.event.kind)?'hero.foot':pool.event.kind==='ground'?'rival.weaponTip → floor':'authored world target'})),
          releaseOrigin: array(eventOrigin(eventPools.find(p => p.event.kind === 'release'), reduced)),
          releaseOriginSource: 'hero sprite.offHand (bow grip) at event54',
          disarm: { time: disarmTime, requested: disarmed, heldWeaponHidden, droppedWeapon: '3D ash spear / silver leaf point' },
        },
        integrationWarnings: disarmed && !heldWeaponHidden ? ['sprites.mjs must honor actorState.disarmed and return weapon:"none" (or weaponHidden:true) to hide the held spear; scene does not erase sprite body pixels.'] : [],
        architecture: {
          columns: 14, columnRows: 7, depthExtent: [-22, 6], braziers: 4,
          layers: ['foreground: leaves / rubble / near columns', 'middle: duel / inlaid floor / columns', 'deep: stairs / bronze doors / pediment / open skylight'],
          ornament: 'original stepped tide meander, reed capital, radial sun geometry',
          real3D: true, alphaTestedSpriteShadows: true,
          staticShadows:'2048px architectural moon shadow map cached once; no per-frame static geometry resubmission',
          dynamicShadows:'two alpha-masked actor floor projections along the moon ray; not shadow maps on arbitrary receiving surfaces',
          contactShadows: 'additional analytic radial floor decals (not ray-traced)',
          reflections: 'PBR local light highlights only; no planar or ray-traced reflections claimed',
          volumeLight: '4 bounded transparent shaft planes; not volumetric ray marching',
        },
        objectCounts: objectCounts(), poster, reduced, beatSeconds: BEAT,
      };
    }
    function draw(input, { reduced = false, poster = false } = {}) {
      assertLive();
      lastTime = clock(input); lastReduced = Boolean(reduced); lastPoster = Boolean(poster);
      const t = poster ? 15.9 : lastTime;
      const state = sample(t, { reduced }), plan = cameraPlan(t, state, poster);
      camera.position.set(...plan.position); actualTarget.set(...plan.target);
      const shake = jitter(t, reduced || poster); camera.position.x += shake[0]; camera.position.y += shake[1];
      camera.fov = plan.fov; camera.aspect = width / height; camera.updateProjectionMatrix();
      camera.lookAt(actualTarget); camera.updateMatrixWorld();
      const focus = focusFor(plan, state); focusPoint.copy(focus.point);
      viewPoint.copy(focusPoint).applyMatrix4(camera.matrixWorldInverse);
      dof.uniforms.focusDistance.value = Math.max(.3, -viewPoint.z);
      dof.uniforms.focusRange.value = plan.range;
      dof.uniforms.maxBlur.value = plan.blur * height / 720;
      const afterimages = updateActors(t, state, plan, reduced);
      updateTrails(t, state, reduced, poster); updateEffects(t, state, reduced);
      dof.uniforms.screenFlash.value = screenFlashAlpha;
      for (const uniforms of fireUniforms) uniforms.time.value = t;
      for (const uniforms of shafts) uniforms.time.value = t;
      for (const fire of fires) fire.light.intensity = 26 * (1 + .06 * Math.sin(t * 7 + fire.seed) + .035 * Math.sin(t * 11.7 + fire.seed * 2));
      particleMaterial.uniforms.height.value = height;
      renderer.info.reset(); composer.render(0);
      if (shaderErrors.length) throw new Error(`HD2D GPU shader compilation failed: ${shaderErrors.join('\n')}`);
      const stats = { ...renderer.info.render, afterimages };
      lastReport = report(t, state, plan, reduced, poster, stats);
      return lastReport;
    }
    function resize(w, h) {
      assertLive();
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) throw new RangeError('HD2D resize(width,height) 需要正数。');
      width = Math.round(w); height = Math.round(h);
      renderer.setSize(width, height, false); composer.setSize(width, height);
      camera.aspect = width / height; camera.updateProjectionMatrix(); particleMaterial.uniforms.height.value = height;
      lastReport = null;
    }
    function inspect(t) {
      if (t === undefined && lastReport) return structuredClone(lastReport);
      const effective = clock(t === undefined ? (lastPoster ? 15.9 : lastTime) : t);
      if (lastReport && effective === lastReport.t) return structuredClone(lastReport);
      const state = sample(effective, { reduced: lastReduced });
      return report(effective, state, cameraPlan(effective, state, false), lastReduced, false);
    }
    function snapshot() { assertLive(); return canvas.toDataURL('image/png'); }
    return { draw, resize, snapshot, inspect, dispose };
  } catch (error) {
    dispose(); throw error;
  }
}