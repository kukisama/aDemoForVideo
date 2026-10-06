import * as THREE from 'three';
import {createActorAtlases, actorContacts} from './actors.mjs';
import {createWesternEnvironment} from './environment.mjs';
import {createWesternPostFX} from './postfx.mjs';

const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
const mix = (a, b, p) => a + (b - a) * p;
const ease = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
const phase = (t, start, end) => ease((t - start) / (end - start));
const rounded = v => Number(v.toFixed(5));
const SCENES = new Set(['valley', 'camp-warm', 'trail', 'camp-cold', 'crossing', 'camp-night', 'valley-dawn']);
const ACTIONS = new Set(['arrival', 'listen', 'ride', 'plan-one', 'trust', 'accept', 'together',
  'convoy', 'stuck', 'push', 'release', 'plan-two', 'offer', 'doubt', 'not-taking',
  'water', 'go-ahead', 'turn-back', 'help', 'plan-three', 'answer', 'fold-map', 'leave', 'coda']);

const LIGHTING = {
  valley: {sky: '#728a95', horizon: '#c4b7a0', ground: '#706043', sun: '#ffdeb3', sunPower: 2.45, ambient: 1.8, fog: [38, 168], exposure: 1.04},
  'camp-warm': {sky: '#758b92', horizon: '#c9b18a', ground: '#775b43', sun: '#ffd3a0', sunPower: 2.1, ambient: 1.65, fog: [26, 132], exposure: 1.05},
  trail: {sky: '#7a8e91', horizon: '#b5ad91', ground: '#6b5e46', sun: '#e8c8a4', sunPower: 1.95, ambient: 1.7, fog: [27, 143], exposure: 1.06},
  'camp-cold': {sky: '#546f82', horizon: '#95a7ac', ground: '#4a5557', sun: '#c1d2dc', sunPower: 1.08, ambient: 1.6, fog: [23, 110], exposure: 1.06},
  crossing: {sky: '#516b7b', horizon: '#91a4a6', ground: '#4b5c5e', sun: '#c8d7d8', sunPower: 1.35, ambient: 1.7, fog: [25, 121], exposure: 1.07},
  'camp-night': {sky: '#111e2d', horizon: '#384b5a', ground: '#343a43', sun: '#adc5e7', sunPower: .62, ambient: 1.0, fog: [20, 86], exposure: 1.12},
  'valley-dawn': {sky: '#739298', horizon: '#d4b399', ground: '#746650', sun: '#ffdaaf', sunPower: 1.8, ambient: 1.85, fog: [39, 181], exposure: 1.04},
};

/**
 * Main thread owns scheduling, playback, captions and title overlays.
 * This module owns only its supplied canvas's WebGL rendering and offscreen atlases.
 * Every transform/frame is assigned from absolute time; there is no integrated simulation.
 */
export function createWesternWorld(canvas, data) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('createWesternWorld 需要主 WebGL canvas。');
  if (!data || !Array.isArray(data.shots) || data.shots.length === 0) throw new TypeError('HD-2D 场景需要 data.shots。');
  const duration = Number(data.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('data.duration 必须是正数秒。');
  const shots = data.shots.map((s, index) => {
    if (!SCENES.has(s.scene) || !ACTIONS.has(s.action) || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start) {
      throw new Error(`HD-2D 分镜 ${index} 的景况、动作或时间范围无效。`);
    }
    if (index && Math.abs(s.start - data.shots[index - 1].end) > .0001) throw new Error(`HD-2D 分镜 ${index} 前存在空隙或重叠。`);
    return {...s, index};
  });
  if (shots[0].start !== 0 || Math.abs(shots.at(-1).end - duration) > .0001) throw new Error('HD-2D 分镜必须完整覆盖 0 至 duration。');

  const attributes = {alpha: false, antialias: false, depth: true, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'high-performance'};
  const gl = canvas.getContext('webgl2', attributes);
  if (!gl || typeof gl.texStorage2D !== 'function') {
    throw new Error('明天以西 HD-2D 需要 WebGL2；当前环境不支持。请启用硬件加速或使用支持 WebGL2 的浏览器。不会降级为二维画面。');
  }
  if (!gl.getContextAttributes()?.preserveDrawingBuffer) {
    throw new Error('主 canvas 已创建不保留缓冲区的上下文；请传入尚未创建上下文的新 canvas。');
  }
  const renderer = new THREE.WebGLRenderer({canvas, context: gl, ...attributes});
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.debug.onShaderError = (context, program, vertex, fragment) => {
    throw new Error(`HD-2D shader 编译失败：${context.getProgramInfoLog(program) || ''}\n${context.getShaderInfoLog(vertex) || ''}\n${context.getShaderInfoLog(fragment) || ''}`);
  };

  const scene = new THREE.Scene(); scene.name = 'western-hd2d';
  const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 320);
  scene.fog = new THREE.Fog('#c4b7a0', 38, 168);
  const ambient = new THREE.HemisphereLight('#a8c4d0', '#706043', 1.8);
  const sun = new THREE.DirectionalLight('#ffdeb3', 2.45);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -31, right: 31, top: 31, bottom: -31, near: 1, far: 125});
  sun.shadow.bias = -.00015; sun.shadow.normalBias = .012;
  const fill = new THREE.DirectionalLight('#b5d2e2', .52); fill.position.set(12, 9, -18);
  const actorKey = new THREE.DirectionalLight('#e5d7c1', .72);
  actorKey.layers.set(1);
  scene.add(ambient, sun, sun.target, fill, actorKey, actorKey.target);
  camera.layers.enable(1);

  const ownedGeometries = new Set(), ownedMaterials = new Set(), actorTextures = new Set();
  const plane = new THREE.PlaneGeometry(1, 1); ownedGeometries.add(plane);
  const skyGeometry = new THREE.SphereGeometry(280, 32, 16); ownedGeometries.add(skyGeometry);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {zenith: {value: new THREE.Color('#728a95')}, horizon: {value: new THREE.Color('#c4b7a0')}, sunAmount: {value: .25}},
    vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 direction; uniform vec3 zenith,horizon; uniform float sunAmount;
      void main(){
        vec3 d=normalize(direction);
        float h=smoothstep(-.08,.78,d.y);
        vec3 c=mix(horizon,zenith,h);
        float s=dot(d,normalize(vec3(-.62,.20,-.76)));
        c+=vec3(1.0,.66,.33)*sunAmount*(.10*pow(max(0.0,s),24.0)+smoothstep(.9993,.99985,s));
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  ownedMaterials.add(skyMaterial);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial); sky.renderOrder = -1000; sky.frustumCulled = false; scene.add(sky);

  let environment, postfx;
  const actors = {}, atlasSources = new Map();
  const cast = new THREE.Group(); cast.name = 'pixel-performers'; scene.add(cast);
  let width = 1280, height = 720, disposed = false, hasDrawn = false;
  let time = 0, activeShot = shots[0], lastOptions = {poster: false, reduced: false};
  let interaction = {}, focusDistance = 15;
  const target = new THREE.Vector3(), focusPoint = new THREE.Vector3(), projectedFocus = new THREE.Vector3();
  const right = new THREE.Vector3(), towardCamera = new THREE.Vector3();
  const handA = new THREE.Vector3(), handD = new THREE.Vector3();
  const secondaryHand = new THREE.Vector3();
  const tableRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  const contactStart = new THREE.Vector3(), contactEnd = new THREE.Vector3(), grip = new THREE.Vector3();
  const armDirection = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const contactGeometry = new THREE.BoxGeometry(1, 1, 1); ownedGeometries.add(contactGeometry);
  const glove = new THREE.MeshStandardMaterial({color: '#c4a37b', roughness: 1}); ownedMaterials.add(glove);
  const contactRig = new THREE.Group(); contactRig.name = 'physical-gesture-contacts'; contactRig.visible = false; scene.add(contactRig);
  const contactArms = ['#73817e', '#927c66'].map(color => {
    const material = new THREE.MeshStandardMaterial({color, roughness: 1}); ownedMaterials.add(material);
    const sleeve = new THREE.Mesh(contactGeometry, material), palm = new THREE.Mesh(contactGeometry, glove);
    sleeve.castShadow = palm.castShadow = true; sleeve.receiveShadow = palm.receiveShadow = true;
    palm.scale.set(.135, .105, .115); contactRig.add(sleeve, palm);
    return {sleeve, palm};
  });

  function textureFor(atlas, label) {
    if (!atlas?.canvas || atlas.columns !== 8 || !Number.isInteger(atlas.rows) || atlas.rows !== atlas.poses?.length ||
      !(atlas.frameWidth > 0) || !(atlas.frameHeight > 0)) throw new Error(`演员图集 ${label} 不符合约定。`);
    if (!atlasSources.has(atlas)) {
      const source = new THREE.CanvasTexture(atlas.canvas);
      source.magFilter = source.minFilter = THREE.NearestFilter;
      source.generateMipmaps = false; source.colorSpace = THREE.SRGBColorSpace;
      atlasSources.set(atlas, source); actorTextures.add(source);
    }
    const texture = atlasSources.get(atlas).clone(); actorTextures.add(texture);
    texture.repeat.set(1 / atlas.columns, 1 / atlas.rows);
    return texture;
  }

  function actorCard(atlas, label, cardHeight, portrait = false) {
    const texture = textureFor(atlas, label);
    const material = new THREE.MeshStandardMaterial({
      map: texture, color: '#ffffff', roughness: .94, metalness: 0,
      alphaTest: .48, transparent: false, depthWrite: true,
      side: THREE.DoubleSide, shadowSide: THREE.DoubleSide,
      // A small albedo-linked fill retains face details without making an unlit UI sticker.
      emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: .12,
    });
    const depth = new THREE.MeshDepthMaterial({map: texture, alphaTest: .48, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide});
    const distance = new THREE.MeshDistanceMaterial({map: texture, alphaTest: .48, side: THREE.DoubleSide});
    ownedMaterials.add(material); ownedMaterials.add(depth); ownedMaterials.add(distance);
    const object = new THREE.Mesh(plane, material);
    object.layers.enable(1);
    object.name = label; object.castShadow = !portrait; object.receiveShadow = true;
    object.customDepthMaterial = depth; object.customDistanceMaterial = distance;
    const cardWidth = cardHeight * atlas.frameWidth / atlas.frameHeight;
    object.scale.set(cardWidth, cardHeight, 1);
    object.position.y = portrait ? 1.91 : cardHeight * (.5 - (atlas.feet ?? .04));
    return {mesh: object, atlas, texture, height: cardHeight, width: cardWidth, portrait};
  }

  function addActor(id, atlas, h, portraitAtlas) {
    const root = new THREE.Group(); root.name = id; root.visible = false; cast.add(root);
    const body = actorCard(atlas, `${id}/body`, h); root.add(body.mesh);
    const portrait = portraitAtlas ? actorCard(portraitAtlas, `${id}/portrait`, 2.8, true) : null;
    if (portrait) { root.add(portrait.mesh); portrait.mesh.visible = false; }
    actors[id] = {id, root, body, portrait, pose: 'idle', frame: 0, mirror: false,
      moving: false, close: false, contact: null, height: h};
    return actors[id];
  }

  function dispose() {
    if (disposed) return; disposed = true;
    postfx?.dispose(); environment?.dispose();
    for (const texture of actorTextures) texture.dispose();
    for (const material of ownedMaterials) material.dispose();
    for (const geometry of ownedGeometries) geometry.dispose();
    sun.shadow.map?.dispose(); sun.shadow.mapPass?.dispose();
    scene.clear(); renderer.dispose();
  }

  try {
    environment = createWesternEnvironment();
    for (const group of Object.values(environment.groups)) { group.visible = false; scene.add(group); }
    scene.add(environment.atmosphere);
    const atlases = createActorAtlases({props:false});
    addActor('arthur', atlases.people.arthur, 2.48, atlases.portraits.arthur);
    addActor('dutch', atlases.people.dutch, 2.53, atlases.portraits.dutch);
    for (let i = 0; i < 6; i++) addActor(`camp-${i}`, atlases.people.camp, 2.13 + (i % 3) * .08);
    addActor('rider', atlases.horses.arthur, 3.48);
    for (let i = 0; i < 3; i++) addActor(`horse-${i}`, atlases.horses.none, 2.42);
    postfx = createWesternPostFX(renderer, width, height);
    renderer.setSize(width, height, false);
  } catch (error) { dispose(); throw error; }

  function place(id, x, y, z, pose = 'idle', {mirror = false, moving = false, contact = null, frame = null} = {}) {
    const actor = actors[id]; actor.root.visible = true; actor.root.position.set(x, y, z);
    actor.pose = pose; actor.mirror = mirror; actor.moving = moving; actor.contact = contact;
    const looping = ['idle','walk','gallop'].includes(pose);
    const actionStart = pose==='push'?69.5:pose==='help'&&activeShot.scene==='crossing'?135.3:activeShot.start;
    actor.frame = frame === null ? (looping ? Math.floor(time * (moving ? 7 : 1.2)) % 8 : clamp(Math.floor(phase(time,actionStart,actionStart+2.3)*7),0,7)) : clamp(Math.floor(frame), 0, 7);
    return actor;
  }

  function campBlocking(shot) {
    const t = time, warm = shot.scene === 'camp-warm', cold = shot.scene === 'camp-cold';
    let ax, az, ap = 'listen', dp = 'point';
    if (warm) {
      const approach = phase(t, 30, 36);
      ax = mix(-2.35, -.95, approach); az = mix(1.1, .32, approach);
      if (shot.action === 'trust') ap = approach < .98 ? 'walk' : 'listen';
      if (shot.action === 'accept') { ap = 'accept'; dp = 'offer'; }
      if (shot.action === 'together') { ax = mix(-.95, -1.6, phase(t, 43, 47)); ap = 'listen'; dp = 'listen'; }
    } else if (cold) {
      const retreat = phase(t, 106.7, 113.5);
      ax = mix(-1.35, -3.25, retreat); az = mix(.52, 1.25, retreat);
      ap = ['doubt', 'not-taking'].includes(shot.action) ? 'doubt' : 'listen';
      if (retreat > 0 && retreat < 1) ap = 'walk';
      dp = shot.action === 'plan-two' ? 'point' : 'offer';
    } else {
      ax = mix(-2.1, -1.06, phase(t, 160.8, 163.2)); az = mix(.85, .36, phase(t, 160.8, 163.2));
      ap = shot.action === 'answer' ? 'point' : shot.action === 'fold-map' ? 'fold' : 'listen';
      dp = shot.action === 'plan-three' ? 'offer' : 'listen';
    }
    const gestureFrame = ap === 'accept' ? phase(t, 37.6, 41.1) * 7 : ap === 'fold' ? phase(t, 163.7, 166.6) * 7 : null;
    place('arthur', ax, 0, az, ap, {moving: ap === 'walk', mirror: cold && t > 106.7,
      contact: ap === 'accept' || ap === 'fold' ? 'map' : null, frame: gestureFrame});
    place('dutch', .95, 0, .12, dp, {mirror: true, contact: ['point', 'offer'].includes(dp) ? 'map' : null,
      frame: dp === 'offer' ? phase(t, shot.start, shot.start + 2.5) * 7 : null});
    // The same campsite becomes lonelier: people approach in the warm scene, withdraw in the cold one.
    const gathering = warm ? phase(t, 43, 49) : cold ? -phase(t, 87, 110) : -1;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (4.7 + Math.floor(i / 2) * 1.6 - gathering * 1.0);
      const z = -3.8 - Math.floor(i / 2) * 2.5 + gathering * .8;
      place(`camp-${i}`, x, 0, z, gathering > .05 && gathering < .98 ? 'walk' : 'listen', {mirror: side > 0, moving: gathering > .05 && gathering < .98});
    }
    place('horse-0', 10.5, 0, -2.7, 'idle', {mirror: true});
    place('horse-1', 12.2, 0, -5.9, 'idle');
    interaction = {kind: 'map', stage: shot.action, accepted: warm && t >= 40.4, folded: !warm && !cold ? phase(t, 163.7, 166.6) : 0};
  }

  function trailBlocking(shot) {
    const {trailWagon: wagon, unloaded} = environment.props;
    const release = phase(time, 75, 84);
    const z = time < 59 ? mix(3.4, 0, phase(time, 51, 59)) : -11.5 * release;
    const sink = phase(time, 59, 61.3) * (1 - phase(time, 75, 76.4));
    wagon.root.position.set(0, -.20 * sink, z);
    wagon.root.rotation.set(0, 0, -.045 * sink);
    for (const wheel of wagon.wheels) wheel.rotation.x = -z / .66;
    const starts = [[-.48, .97, .85], [.42, .97, .8], [0, 1.6, .76]];
    const ends = [[3.3, 0, 2.4], [4.2, 0, 1.9], [3.8, 0, 2.8]];
    let movingCrate = -1;
    for (let i = 0; i < 3; i++) {
      const p = phase(time, 66 + i * 1.1, 67.1 + i * 1.1);
      wagon.cargo[i].visible = time < 66 + i * 1.1;
      unloaded[i].visible = time >= 66 + i * 1.1;
      unloaded[i].position.set(mix(starts[i][0], ends[i][0], p), mix(starts[i][1] - .20, 0, p) + .23 * Math.sin(p * Math.PI), mix(starts[i][2], ends[i][2], p));
      if (p > 0 && p < 1) movingCrate = i;
    }
    let pose = 'walk', ax = -1.45, az = z + 2.8;
    if (shot.action === 'stuck') { pose = 'doubt'; ax = -1.8; az = 2.55; }
    if (shot.action === 'push') {
      pose = time < 69.5 ? 'accept' : 'push';
      ax = mix(-1.8, -.15, phase(time, 68.8, 70.1)); az = 2.42;
    }
    if (shot.action === 'release') { ax = -.15; az = z + 2.42; pose = release < .15 ? 'push' : 'walk'; }
    place('arthur', ax, 0, az, pose, {moving: pose === 'walk',mirror:pose==='push',contact: pose === 'push' ? 'wagon-rear' : time >= 66 && time < 69.5 ? 'cargo' : null});
    const helperPush = (shot.action === 'push' && time >= 69.5) || (shot.action === 'release' && release < .15);
    place('camp-0', 1.0, 0, z + 2.6, helperPush ? 'push' : time < 59 || time >= 75 ? 'walk' : 'listen',
      {moving: time < 59 || time >= 75, contact: helperPush ? 'wagon-rear' : null, mirror: true});
    if (movingCrate >= 0) {
      const p = unloaded[movingCrate].position;
      place('camp-1', p.x - .25, 0, p.z + .45, 'accept', {contact: `cargo-${movingCrate}`});
    } else place('camp-1', 3.4, 0, z + 3.6, time < 59 || time >= 75 ? 'walk' : 'listen', {moving: time < 59 || time >= 75});
    place('camp-2', 1.6, 0, z + 5.7, time < 59 || time >= 75 ? 'walk' : 'listen', {moving: time < 59 || time >= 75});
    if(shot.action==='push'&&time>=69.5){
      actors['camp-1'].root.position.set(4.9,0,-2.2);
      actors['camp-2'].root.position.set(5.7,0,-4.3);
    }
    place('dutch', 3.6, 0, z - 4.3, 'point', {mirror: true});
    place('horse-0', 0, 0, z - 5.2, time < 59 || time >= 75 ? 'walk' : 'idle', {moving: time < 59 || time >= 75});
    interaction = {kind: 'wagon', stage: shot.action, wagonPosition: [0, -.20 * sink, z].map(rounded),
      wheelRotation: rounded(-z / .66), unloadedCount: unloaded.filter(c => c.visible).length, movingCrate};
  }

  const bridgeHeight = z => .425 * Math.min(phase(z, -13.6, -12.5), 1 - phase(z, 2.6, 3.6));
  function crossingBlocking(shot) {
    const returning = phase(time, 130, 135.3), escort = phase(time, 138.1, 144);
    let az = mix(-2.8, 5.0, returning), ax = -.65, pose = 'listen';
    let lagZ = 5, lagX = .64;
    if (shot.action === 'turn-back') pose = time < 130 ? 'turn' : time < 135.3 ? 'walk' : 'help';
    if (shot.action === 'help') { az = mix(5, -14.2, escort); lagZ = az + .12; pose = escort === 0 ? 'help' : 'walk'; }
    const dz = mix(-9.6, -15, phase(time, 123, 129));
    place('arthur', ax, bridgeHeight(az), az, pose, {moving: pose === 'walk', contact: time >= 135.3 ? 'camp-0-hand' : null});
    place('camp-0', lagX, bridgeHeight(lagZ), lagZ, time >= 138.1 ? 'walk' : 'help', {moving: time >= 138.1, mirror: true, contact: time >= 135.3 ? 'arthur-hand' : null});
    const dutchWalking = time >= 124.5 && time < 129;
    place('dutch', .25, bridgeHeight(dz), dz, dutchWalking ? 'walk' : shot.action === 'go-ahead' ? 'point' : 'listen', {mirror: true, moving: dutchWalking});
    for (let i = 1; i < 4; i++) place(`camp-${i}`, -1.7 + i * 1.05, 0, -15.2 - i * 1.3, 'listen', {mirror: true});
    place('horse-0', 4.4, 0, -17.5, 'idle', {mirror: true});
    interaction = {kind: 'crossing', stage: shot.action, returning: rounded(returning), escort: rounded(escort),
      handContact: time >= 135.3, memberJoined: lagZ < -13.4};
  }

  function valleyBlocking(shot) {
    const dawn = shot.scene === 'valley-dawn';
    const travel = dawn ? phase(time, 168, 180) : phase(time, 0, 21);
    const z = dawn ? mix(4, -26, travel) : mix(7, -7, travel);
    const x = dawn ? mix(2.8, -.3, travel) : mix(3.1, .6, travel);
    place('rider', x, 0, z, 'walk', {moving: true});
    if (shot.view === 'arthur-close') {
      actors.rider.root.visible = false;
      place('arthur', x, .86, z, 'listen');
      place('horse-0', x - .15, 0, z + .8, 'idle');
    }
    if (!dawn) {
      place('horse-1', x + 3.9, 0, z + 6, 'walk', {moving: true});
      place('camp-0', x + 3, 0, z + 7.6, 'walk', {moving: true});
      place('camp-1', x + 4.6, 0, z + 9.7, 'walk', {moving: true});
    }
    interaction = {kind: dawn ? 'departure' : 'arrival', stage: shot.action, solitary: dawn, distance: rounded(travel)};
  }

  function setCamera(shot, reduced) {
    const p = ease((time - shot.start) / (shot.end - shot.start));
    const dolly = reduced ? .5 : p;
    camera.fov = 43;
    const name = shot.view.startsWith('dutch') ? 'dutch' : 'arthur';
    const actor = actors[name], pos = actor.root.position;
    if (shot.view.endsWith('-close')) {
      actor.close = true; actor.body.mesh.visible = false; actor.portrait.mesh.visible = true;
      const side = name === 'arthur' ? -.28 : .28;
      target.set(pos.x + side, pos.y + 2.09, pos.z);
      camera.position.set(pos.x + side + mix(.24, -.14, dolly), pos.y + 2.35, pos.z + mix(4.5, 4.25, dolly));
      camera.fov = 40;
      focusPoint.set(pos.x, pos.y + 2.15, pos.z);
    } else if (shot.view.endsWith('-medium')) {
      const sign = name === 'arthur' ? 1 : -1;
      const xOffset = shot.scene === 'trail' ? -5.2 : sign * 2.6;
      target.set(pos.x + sign * .18, pos.y + 1.47, pos.z - .08);
      camera.position.set(pos.x + xOffset + .24 * dolly, pos.y + 2.95, pos.z + mix(7.3, 6.8, dolly));
      camera.fov = shot.scene === 'trail' ? 46 : 41;
      focusPoint.set(pos.x, pos.y + 1.45, pos.z);
    } else if (shot.view === 'map') {
      camera.position.set(mix(.6, 1.1, dolly), 3.7, mix(5.35, 5.0, dolly));
      target.set(-.12, 1.27, .04); focusPoint.copy(target); camera.fov = 39;
    } else if (shot.view === 'two-shot') {
      camera.position.set(mix(.35, .75, dolly), 2.65, 8.4);
      target.set(-.7, 1.45, .15); focusPoint.copy(target); camera.fov = 42;
    } else if (shot.view === 'wagon') {
      const z = environment.props.trailWagon.root.position.z;
      camera.position.set(mix(-6.3, -5.6, dolly), 2.0, z + 5.5);
      target.set(-.65, .97, z + .75); focusPoint.copy(target); camera.fov = 43;
    } else if (shot.view === 'rider') {
      const r = actors.rider.root.position;
      camera.position.set(r.x + mix(8.5, 7.6, dolly), 4.3, r.z + 10);
      target.set(r.x, 1.95, r.z - .8); focusPoint.set(r.x, 1.7, r.z); camera.fov = 43;
    } else if (shot.scene === 'valley' || shot.scene === 'valley-dawn') {
      const dawn = shot.scene === 'valley-dawn';
      camera.position.set(mix(18.5, 16.4, dolly), dawn ? 8.8 : 8.2, dawn ? 27 : 23);
      target.set(dawn ? -4 : -3, dawn ? 2.3 : 1.8, dawn ? -14 : -6);
      focusPoint.copy(actors.rider.root.position); focusPoint.y += 1.6;
      camera.fov = dawn ? 46 : 45;
    } else if (shot.scene === 'crossing') {
      camera.position.set(mix(14.8, 13.1, dolly), 8.1, mix(17.5, 16.6, dolly));
      target.set(0, .95, -4.4); focusPoint.set(0, 1.5, shot.action === 'help' ? mix(3, -10, phase(time, 138.1, 144)) : -3.5); camera.fov = 46;
    } else if (shot.scene === 'trail') {
      const z = environment.props.trailWagon.root.position.z;
      camera.position.set(mix(13.8, 12.7, dolly), 6.7, z + 16.8);
      target.set(.2, 1.55, z - 1.3); focusPoint.set(0, 1.45, z); camera.fov = 45;
    } else {
      camera.position.set(mix(11.4, 10.4, dolly), 6.4, 16.2);
      target.set(0, 1.55, -2.6); focusPoint.set(-.5, 1.5, 0); camera.fov = 46;
    }
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    projectedFocus.copy(focusPoint).applyMatrix4(camera.matrixWorldInverse);
    focusDistance = Math.max(.3, -projectedFocus.z);
    sky.position.copy(camera.position);
  }

  function frameCard(card, actor) {
    const row = card.atlas.poses.indexOf(actor.pose);
    if (row < 0) throw new Error(`演员 ${actor.id} 的图集缺少动作 ${actor.pose}。`);
    const columns = card.atlas.columns, rows = card.atlas.rows;
    card.texture.repeat.set((actor.mirror ? -1 : 1) / columns, 1 / rows);
    card.texture.offset.set((actor.frame + (actor.mirror ? 1 : 0)) / columns, 1 - (row + 1) / rows);
    if (card.portrait) card.mesh.quaternion.copy(camera.quaternion);
    else {
      card.mesh.rotation.set(0, Math.atan2(camera.position.x - actor.root.position.x, camera.position.z - actor.root.position.z), 0);
    }
  }

  function hand(actor, side, out) {
    const card=actor.close?actor.portrait:actor.body;
    const identity=actor.id==='arthur'?'arthur':actor.id==='dutch'?'dutch':'camp';
    const contacts=actorContacts(identity,actor.pose,actor.frame,actor.close);
    const point=side>0?contacts.near:contacts.far;
    out.set((point[0]/card.atlas.frameWidth-.5)*(actor.mirror?-1:1),.5-point[1]/card.atlas.frameHeight,-.012);
    card.mesh.updateWorldMatrix(true,false);
    out.applyMatrix4(card.mesh.matrixWorld);
    return out;
  }

  function bothHands(actor,out){hand(actor,1,out);hand(actor,-1,secondaryHand);return out.add(secondaryHand).multiplyScalar(.5);}

  function mapBlocking(shot) {
    const paper = environment.props.campMap;
    const arthur = actors.arthur, dutch = actors.dutch;
    bothHands(arthur, handA); bothHands(dutch, handD);
    const warm = shot.scene === 'camp-warm', cold = shot.scene === 'camp-cold';
    let transfer = 0, lift = 1, fold = 0;
    if (warm) { lift = phase(time, 37, 38); transfer = phase(time, 39, 41.1); }
    if (cold) lift = phase(time, 93, 94.5);
    if (!warm && !cold) {
      // Dutch lowers the map; Arthur retrieves it, folds the hinge and keeps it.
      lift = time < 162.15 ? 1 - phase(time, 161, 162.1) : phase(time, 162.15, 163.6);
      transfer = phase(time, 162.1, 162.4); fold = phase(time, 163.7, 166.6);
    }
    const heldX = mix(handD.x, handA.x, transfer);
    const heldY = mix(handD.y, handA.y, transfer)+.075;
    const heldZ = mix(handD.z, handA.z, transfer);
    paper.root.position.set(mix(0, heldX, lift), mix(1.145, heldY, lift), mix(-.65, heldZ, lift));
    const host=transfer>.5?arthur:dutch,card=host.close?host.portrait:host.body;
    const propScale=card.width*(host.close?59:25)/card.atlas.frameWidth/.96;
    paper.root.scale.setScalar(mix(1,propScale,lift));paper.root.scale.y*=mix(1,.65,lift);
    paper.root.quaternion.copy(tableRotation).slerp(card.mesh.quaternion,lift);
    paper.setFold(fold);
    interaction.mapPosition = paper.root.position.toArray().map(rounded);
    interaction.holder = lift < .15 ? 'table' : transfer > .9 ? 'arthur' : transfer > .1 ? 'both' : 'dutch';
    interaction.folded = rounded(fold);
    interaction.hands = {arthur: handA.toArray().map(rounded), dutch: handD.toArray().map(rounded)};
  }

  function connectArm(index, start, end) {
    const arm = contactArms[index]; arm.sleeve.visible = arm.palm.visible = true; contactRig.visible = true;
    armDirection.copy(end).sub(start);
    const length = Math.max(.001, armDirection.length());
    arm.sleeve.position.copy(start).add(end).multiplyScalar(.5);
    arm.sleeve.scale.set(.095, length, .095);
    arm.sleeve.quaternion.setFromUnitVectors(up, armDirection.multiplyScalar(1 / length));
    arm.palm.position.copy(end); arm.palm.quaternion.copy(arm.sleeve.quaternion);
  }

  function physicalContacts(shot) {
    contactRig.visible = false;
    for (const arm of contactArms) arm.sleeve.visible = arm.palm.visible = false;
    if (shot.scene === 'crossing' && time >= 135.3) {
      hand(actors.arthur, 1, handA); hand(actors['camp-0'], -1, handD);
      grip.copy(handA).add(handD).multiplyScalar(.5);
      connectArm(0, handA, grip); connectArm(1, handD, grip);
      interaction.gripPosition = grip.toArray().map(rounded);
    } else if (shot.scene === 'trail' && actors.arthur.pose === 'push') {
      const wagon = environment.props.trailWagon.root.position;
      for (const [index, id, side] of [[0, 'arthur', 1], [1, 'camp-0', -1]]) {
        hand(actors[id], side, contactStart);
        contactEnd.set(index ? .52 : -.52, 1.25 + wagon.y, wagon.z + 1.91);
        connectArm(index, contactStart, contactEnd);
      }
      interaction.pushContact = true;
    }
  }

  function lighting(shot) {
    const values = LIGHTING[shot.scene];
    ambient.color.set(values.sky); ambient.groundColor.set(values.ground); ambient.intensity = values.ambient;
    sun.color.set(values.sun); sun.intensity = values.sunPower;
    const anchor = shot.scene === 'trail' ? environment.props.trailWagon.root.position : focusPoint;
    sun.target.position.set(anchor.x, 0, anchor.z);
    sun.position.set(anchor.x - 29, shot.scene === 'valley-dawn' ? 22 : 38, anchor.z + 21);
    sun.shadow.camera.updateProjectionMatrix();
    fill.intensity = shot.scene === 'camp-night' ? .38 : .52;
    actorKey.position.copy(camera.position);
    actorKey.target.position.copy(target);
    actorKey.intensity=shot.scene==='camp-night'?.62:.84;
    actorKey.color.set(shot.scene==='camp-night'?'#e5be90':'#eadcc5');
    scene.fog.color.set(values.horizon); scene.fog.near = values.fog[0]; scene.fog.far = values.fog[1];
    skyMaterial.uniforms.zenith.value.set(values.sky); skyMaterial.uniforms.horizon.value.set(values.horizon);
    skyMaterial.uniforms.sunAmount.value = shot.scene === 'camp-night' ? 0 : .24;
    return values;
  }

  function assertLive() {
    if (disposed) throw new Error('createWesternWorld 已 dispose，不能再绘制或截图。');
    if (gl.isContextLost()) throw new Error('HD-2D WebGL2 上下文已丢失；请由播放器提示重新加载。');
  }

  function draw(absoluteTime, {poster = false, reduced = false} = {}) {
    assertLive();
    if (!Number.isFinite(absoluteTime)) throw new TypeError('draw(time) 的 time 必须是有限秒数。');
    time = clamp(absoluteTime, 0, duration); lastOptions = {poster: Boolean(poster), reduced: Boolean(reduced)};
    // Half-open intervals; exactly 180s belongs to the final shot, not an empty scene.
    activeShot = shots.find(s => time >= s.start && time < s.end) ?? shots.at(-1);
    const shot = activeShot;
    const groupKey = shot.scene.startsWith('camp-') ? 'camp' : shot.scene.startsWith('valley') ? 'valley' : shot.scene;
    for (const [key, group] of Object.entries(environment.groups)) group.visible = key === groupKey;
    for (const actor of Object.values(actors)) {
      actor.root.visible = false; actor.close = false; actor.contact = null;
      actor.body.mesh.visible = true; if (actor.portrait) actor.portrait.mesh.visible = false;
    }
    environment.props.campMap.root.visible = groupKey === 'camp';
    environment.props.crossingMap.root.visible = false;
    if (groupKey === 'camp') campBlocking(shot);
    else if (groupKey === 'trail') trailBlocking(shot);
    else if (groupKey === 'crossing') crossingBlocking(shot);
    else valleyBlocking(shot);
    setCamera(shot, reduced || poster);
    for (const actor of Object.values(actors)) {
      if (!actor.root.visible) continue;
      // Freeze only ambient idle loops in reduced mode; all narrative movement still seeks correctly.
      if ((reduced || poster) && actor.pose==='idle') actor.frame = 0;
      frameCard(actor.body, actor); if (actor.portrait) frameCard(actor.portrait, actor);
    }
    if (groupKey === 'camp') mapBlocking(shot);
    physicalContacts(shot);
    environment.update(shot.scene, time, reduced || poster);
    const palette = lighting(shot);
    renderer.info.reset();
    postfx.render(scene, camera, {
      focus: focusDistance, aperture: shot.view.endsWith('-close') ? 1.08 : shot.view === 'wide' ? .72 : .88,
      exposure: palette.exposure, bloom: shot.scene === 'camp-night' ? .13 : .085,
      // The HTML title remains the player's responsibility, including its final hold.
      fade: 1,
    });
    hasDrawn = true;
  }

  function resize(requestedWidth, requestedHeight) {
    assertLive();
    if (!(requestedWidth > 0) || !(requestedHeight > 0) || !Number.isFinite(requestedWidth) || !Number.isFinite(requestedHeight)) {
      throw new RangeError('resize(width,height) 需要有限的正数尺寸。');
    }
    const scale = Math.min(1, 1280 / requestedWidth, 720 / requestedHeight);
    width = Math.max(1, Math.floor(requestedWidth * scale)); height = Math.max(1, Math.floor(requestedHeight * scale));
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); postfx.resize(width, height);
    if (hasDrawn) draw(time, lastOptions);
  }

  function info() {
    const actorStates = {};
    for (const [id, actor] of Object.entries(actors)) {
      if (!actor.root.visible) continue;
      actorStates[id] = {pose: actor.pose, frame: actor.frame, position: actor.root.position.toArray().map(rounded),
        mirror: actor.mirror, portrait: actor.close, moving: actor.moving, contact: actor.contact};
    }
    let objectCount = 0, instancedMeshes = 0, instances = 0;
    scene.traverseVisible(object => {
      if (object.isMesh || object.isPoints) objectCount++;
      if (object.isInstancedMesh) { instancedMeshes++; instances += object.count; }
    });
    return {
      renderer: 'webgl2', threeRevision: THREE.REVISION, scene: activeShot.scene,
      shot: {...activeShot}, time, duration, width, height, actorStates,
      postfxEnabled: !disposed, postfx: postfx?.info() ?? null,
      geometryCount: environment.info().geometryCount + ownedGeometries.size + 1,
      objectCount, instancedMeshes, instances, drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles, interaction: JSON.parse(JSON.stringify(interaction)),
      camera: {position: camera.position.toArray().map(rounded), target: target.toArray().map(rounded), fov: camera.fov, focusDistance: rounded(focusDistance)},
      renderCap: [1280, 720], preferredAspect: '16:9', subtitleSafeBottom: .16,
      absoluteTime: true, autonomousLoop: false, fallback2D: false, hasDrawn, disposed,
    };
  }

  return {
    draw, resize,
    snapshot() { assertLive(); if (!hasDrawn) draw(time, {poster: true}); return canvas.toDataURL('image/png'); },
    info, dispose,
  };
}