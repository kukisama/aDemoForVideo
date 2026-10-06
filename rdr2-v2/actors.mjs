/**
 * Original pixel actors for 明天以西. No source images, fonts, game assets,
 * renderer, clock or network. Importing this module does not allocate a canvas.
 *
 * Facing: three-quarter right; horses travel right. Mirror at placement time.
 * Frames: 0..7, rows: poses in the returned descriptor. One-shot actions HOLD
 * their last frame; only idle/walk (and horse gallop) are intended to wrap.
 * Texture sampling, lighting, depth of field and shadows belong to the caller.
 * The transparent four-pixel minimum gutter is NOT a painted ground shadow.
 * Portraits are separate waist-up illustrations, not magnified person sprites;
 * their lower silhouette is anchored at 0.96 just like the other atlas types.
 *
 * Returned canvases are module-owned and cached. Treat them as read-only;
 * do not resize, clear, transferControlToOffscreen, or close them. If ownership
 * must be transferred, make a copy in the caller. No canvas is attached to DOM.
 */

export const PERSON_POSES = ['idle', 'walk', 'listen', 'point', 'offer', 'accept', 'push', 'help', 'turn', 'fold', 'doubt'];

const HORSE_POSES = ['idle', 'walk', 'gallop'];
const COLUMNS = 8;
const INK = '#24232a';
const PAPER = ['#665746', '#bda67c', '#dec79b', '#f2dfb4'];
const cachedAtlases = new Map();

// Material ramps: cool occlusion, local colour, restrained warm edge light.
// No near-white silhouette rims: these remain usable in cold/night scenes.
const PALETTES = {
  arthur: {
    skin: ['#654b43', '#996e56', '#be9270', '#ddaf85', '#ebc59a'],
    hair: ['#342c2a', '#503a2f', '#715039', '#906647'],
    hat: ['#302923', '#4b392d', '#66503b', '#897050', '#aa8b62'],
    shirt: ['#263947', '#36556a', '#52758a', '#7293a1', '#97adb3'],
    vest: ['#263947', '#36556a', '#52758a', '#7293a1'],
    pants: ['#303335', '#484a46', '#646355', '#817b67'],
    leather: ['#332a25', '#57402e', '#7a5738', '#a17c50'],
    boot: ['#242326', '#3c322b', '#584335', '#796149'],
    accent: ['#473b30', '#715f47', '#aa9671'],
    eye: '#8dabb0', seed: 0x41525448,
  },
  dutch: {
    skin: ['#685049', '#a07861', '#c29b7a', '#dfb993', '#efd0a8'],
    hair: ['#252329', '#383033', '#51403d', '#725952'],
    hat: ['#201f26', '#302e36', '#48434a', '#665b60', '#81716c'],
    shirt: ['#686b6b', '#9b9c94', '#c7c6b3', '#e2dcc4', '#f1e6cd'],
    vest: ['#252630', '#363540', '#504a52', '#71626a'],
    pants: ['#292a32', '#40414a', '#595862', '#79747b'],
    leather: ['#2b2629', '#4a3634', '#6a4c40', '#93715a'],
    boot: ['#222128', '#34303a', '#514652', '#776472'],
    accent: ['#552d36', '#963e41', '#bf5b52'],
    eye: '#736c53', seed: 0x44555443,
  },
  camp: {
    skin: ['#59433b', '#855e48', '#ab7b58', '#cb9c73', '#dfb68d'],
    hair: ['#2d2d2b', '#424138', '#62604d', '#84816a'],
    hat: ['#363b36', '#525c4d', '#788168', '#9ba089', '#bcb8a0'],
    shirt: ['#424c44', '#647363', '#87967a', '#acb69a', '#c7ccb0'],
    vest: ['#4d4137', '#715f49', '#94805f', '#b7a281'],
    pants: ['#3d3835', '#5c5145', '#7a6953', '#96846b'],
    leather: ['#37302b', '#5e4836', '#876b48', '#b09363'],
    boot: ['#29282a', '#494039', '#685749', '#8c7560'],
    accent: ['#785c3b', '#b08d56', '#d3b77d'],
    eye: '#4e4935', seed: 0x43414d50,
  },
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const rounded = point => point.map(Math.round);
const at = (point, dx, dy) => [point[0] + dx, point[1] + dy];
const mixPoint = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

// Stateless integer seed: texture identity never depends on draw order/frame.
function grain(seed, x, y) {
  let n = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** Integer scan conversion, not Canvas antialiased vector fills. */
class Pixels {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    this.colors = new Map();
  }

  color(hex) {
    let rgb = this.colors.get(hex);
    if (!rgb) {
      const n = Number.parseInt(hex.slice(1), 16);
      rgb = [n >>> 16, (n >>> 8) & 255, n & 255];
      this.colors.set(hex, rgb);
    }
    return rgb;
  }

  dot(color, x, y) {
    x = Math.round(x); y = Math.round(y);
    // Fail on a clipped silhouette rather than quietly ship a truncated boot.
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new RangeError(`Actor pixel outside ${this.width}x${this.height}: ${x},${y}`);
    }
    const rgb = this.color(color), offset = (y * this.width + x) * 4;
    this.data[offset] = rgb[0]; this.data[offset + 1] = rgb[1];
    this.data[offset + 2] = rgb[2]; this.data[offset + 3] = 255;
  }

  rect(color, x, y, width, height) {
    x = Math.round(x); y = Math.round(y);
    width = Math.max(0, Math.round(width)); height = Math.max(0, Math.round(height));
    for (let v = 0; v < height; v++) for (let u = 0; u < width; u++) this.dot(color, x + u, y + v);
  }

  line(color, a, b, width = 1) {
    let [x, y] = rounded(a);
    const [endX, endY] = rounded(b), dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.rect(color, x - Math.floor(width / 2), y - Math.floor(width / 2), width, width);
      if (x === endX && y === endY) break;
      const e = 2 * error;
      if (e >= dy) { error += dy; x += sx; }
      if (e <= dx) { error += dx; y += sy; }
    }
  }

  poly(color, vertices) {
    const points = vertices.map(rounded);
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));
    for (let y = minY; y < maxY; y++) {
      const crossings = [], scan = y + 0.5;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j], b = points[i];
        if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) {
          crossings.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const x = Math.ceil(crossings[i] - 0.5), end = Math.ceil(crossings[i + 1] - 0.5);
        this.rect(color, x, y, end - x, 1);
      }
    }
  }

  oval(color, cx, cy, rx, ry) {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const span = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
      const x = Math.ceil(cx - span), right = Math.floor(cx + span);
      this.rect(color, x, y, right - x + 1, 1);
    }
  }

  path(color, points, width = 1) {
    for (let i = 1; i < points.length; i++) this.line(color, points[i - 1], points[i], width);
  }

  // Texture only touches already-painted pixels of one material. Local origin
  // pins the sparse clusters to the garment, not to the atlas or frame number.
  texture(base, shade, x, y, width, height, seed, modulus = 29) {
    const rgb = this.color(base);
    for (let v = 0; v < height; v++) for (let u = 0; u < width; u++) {
      const px = Math.round(x + u), py = Math.round(y + v);
      if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
      const offset = (py * this.width + px) * 4;
      if (this.data[offset + 3] && rgb.every((value, i) => this.data[offset + i] === value)
        && grain(seed, u, v) % modulus === 0) this.dot(shade, px, py);
    }
  }
}

// Tapered anatomical segments instead of identical thick line-stick limbs.
function segment(d, a, b, startWidth, endWidth, ramp, far = false) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const shape = (wa, wb) => [
    at(a, nx * wa, ny * wa), at(b, nx * wb, ny * wb),
    at(b, -nx * wb, -ny * wb), at(a, -nx * wa, -ny * wa),
  ];
  d.poly(INK, shape(startWidth / 2 + 1, endWidth / 2 + 1));
  d.poly(ramp[far ? 1 : 2], shape(startWidth / 2, endWidth / 2));
  d.line(ramp[0], at(a, nx * startWidth * 0.3, ny * startWidth * 0.3), at(b, nx * endWidth * 0.3, ny * endWidth * 0.3));
  if (!far) d.line(ramp[3], at(a, -nx * startWidth * 0.25, -ny * startWidth * 0.25), at(b, -nx * endWidth * 0.25, -ny * endWidth * 0.25));
}

// Authored contacts: walk is an eight-frame cycle without a duplicated end.
// Positions are offsets from each hip; bottom of each planted sole is y=123.
const PERSON_WALK = [
  { far: [-9, 0], near: [9, 0], fk: [-4, 0], nk: [5, 0], bob: 0, swing: 5 },
  { far: [-7, 0], near: [6, -3], fk: [-5, 1], nk: [7, -2], bob: 1, swing: 3 },
  { far: [-2, 0], near: [-2, -6], fk: [-2, 0], nk: [5, -4], bob: 0, swing: 0 },
  { far: [4, 0], near: [-8, -3], fk: [3, 0], nk: [-3, -3], bob: -1, swing: -3 },
  { far: [9, 0], near: [-9, 0], fk: [5, 0], nk: [-4, 0], bob: 0, swing: -5 },
  { far: [6, -3], near: [-7, 0], fk: [7, -2], nk: [-5, 1], bob: 1, swing: -3 },
  { far: [-2, -6], near: [-2, 0], fk: [5, -4], nk: [-2, 0], bob: 0, swing: 0 },
  { far: [-8, -3], near: [4, 0], fk: [-3, -3], nk: [3, 0], bob: -1, swing: 3 },
];

function personState(identity, pose, frame) {
  const u = frame / 7, t = ease(u), dutch = identity === 'dutch';
  const state = {
    cx: 48, shoulderY: dutch ? 45 : 46, hipY: 80,
    lean: dutch ? -1 : 1, headX: 0, headY: 0, turn: 0.3,
    farElbow: [32, 62], farHand: [33, 79], nearElbow: [64, 62], nearHand: [63, 79],
    farFoot: [41, 119], nearFoot: [55, 119], farKnee: [40, 99], nearKnee: [55, 99],
    eyes: 1, gaze: 1, brow: 0, mouth: 0, tilt: 0, prop: null, propT: 0,
    farGesture: 'rest', nearGesture: 'rest', shoulderDrop: 0,
  };
  if (identity === 'camp') { state.lean = -1; state.shoulderY = 48; state.hipY = 81; }
  if (pose === 'idle') {
    // Quiet inhalation, release, a single blink; feet stay planted.
    const breath = [0, 0, -1, -1, -1, 0, 0, 0][frame];
    state.shoulderY += breath; state.headY = breath;
    state.eyes = [1, 1, 1, 1, 0.4, 0, 1, 1][frame];
    if (dutch) { state.farElbow = [29, 63]; state.farHand = [38, 75]; state.nearHand = [59, 77]; }
  } else if (pose === 'walk') {
    const key = PERSON_WALK[frame];
    state.hipY += key.bob; state.shoulderY += key.bob; state.headY = key.bob;
    state.farFoot = at([41, 119], ...key.far); state.nearFoot = at([55, 119], ...key.near);
    state.farKnee = at([41, 98], ...key.fk); state.nearKnee = at([55, 98], ...key.nk);
    state.farElbow = [33 - key.swing * 0.4, 61 + key.bob]; state.farHand = [33 - key.swing, 77 + key.bob];
    state.nearElbow = [62 + key.swing * 0.5, 62 + key.bob]; state.nearHand = [62 + key.swing, 77 + key.bob];
    state.lean = dutch ? 0 : 2;
  } else if (pose === 'listen') {
    const nod = [0, 0, 1, 2, 2, 1, 0, 0][frame];
    state.headY = nod; state.headX = t; state.tilt = nod;
    state.turn = mix(0.1, 0.5, t); state.gaze = 1;
    state.eyes = [1, 1, 0.6, 0.5, 1, 1, 1, 1][frame];
    state.nearHand = mixPoint([63, 79], [59, 75], t);
    state.shoulderDrop = t;
  } else if (pose === 'point') {
    const reach = ease((u - 0.12) / 0.62);
    state.nearElbow = mixPoint([64, 62], [72, 48], reach);
    state.nearHand = mixPoint([63, 79], [81, 40], reach);
    state.nearGesture = reach > 0.55 ? 'point' : 'rest';
    state.turn = mix(0.2, 0.8, t); state.headX = t * 2; state.headY = -t;
    state.brow = -t; state.mouth = [0, 0, 1, 2, 1, 1, 0, 0][frame];
    state.farHand = mixPoint([33, 79], [40, 72], reach);
  } else if (pose === 'offer') {
    const reach = ease((u - 0.1) / 0.75);
    state.farElbow = mixPoint([34, 64], [54, 64], reach);
    state.farHand = mixPoint([47, 71], [65, 62], reach);
    state.nearElbow = mixPoint([64, 63], [69, 62], reach);
    state.nearHand = mixPoint([59, 72], [77, 61], reach);
    state.prop = 'map'; state.propT = 0;
    state.farGesture = 'support'; state.nearGesture = 'pinch';
    state.headY = -t; state.turn = 0.4 + t * 0.3; state.brow = -0.5;
    state.mouth = [0, 1, 2, 1, 1, 0, 0, 0][frame];
  } else if (pose === 'accept') {
    const reach = ease(u / 0.5), drawBack = ease((u - 0.55) / 0.45);
    state.nearElbow = mixPoint([64, 63], [69, 65], reach);
    state.nearHand = mixPoint(mixPoint([63, 79], [78, 61], reach), [58, 68], drawBack);
    state.farElbow = mixPoint([32, 62], [42, 68], reach);
    state.farHand = mixPoint(mixPoint([33, 79], [64, 65], reach), [44, 70], drawBack);
    // Incoming paper becomes actor-owned at the contact frame, not before.
    state.prop = frame >= 3 ? 'map' : null;
    state.nearGesture = frame >= 3 ? 'pinch' : 'open'; state.farGesture = 'support';
    state.headY = [0, 0, 1, 2, 3, 3, 2, 2][frame]; state.gaze = frame > 3 ? 0 : 1;
  } else if (pose === 'push') {
    const load = ease(u / 0.65), drive = ease((u - 0.5) / 0.5);
    state.lean = 1 + 13 * load; state.hipY = 80 + load * 2;
    state.shoulderY = 46 + 9 * load - drive * 2; state.headY = 7 * load - drive;
    state.headX = 7 * load; state.tilt = load * 2; state.brow = load;
    state.farFoot = mixPoint([41, 119], [31, 119], load);
    state.nearFoot = mixPoint([55, 119], [62, 119], load);
    state.farKnee = mixPoint([40, 99], [42, 99], load);
    state.nearKnee = mixPoint([55, 99], [66, 99], load);
    state.farElbow = mixPoint([32, 62], [63, 65], load);
    state.nearElbow = mixPoint([64, 62], [74 - drive * 2, 65], load);
    state.farHand = mixPoint([33, 79], [80, 57], load);
    state.nearHand = mixPoint([63, 79], [84, 62], load);
    state.farGesture = state.nearGesture = load > 0.3 ? 'brace' : 'rest';
    state.eyes = 1 - load * 0.35; state.mouth = -load;
  } else if (pose === 'help') {
    const bend = [0, 0.2, 0.65, 1, 1, 0.85, 0.6, 0.4][frame];
    const catchHand = ease((u - 0.55) / 0.45);
    state.lean = 2 + bend * 7; state.shoulderY += bend * 6; state.hipY += bend * 2;
    state.headY = bend * 5; state.headX = bend * 3; state.tilt = bend * 2;
    state.farFoot = mixPoint([41, 119], [35, 119], t);
    state.nearFoot = mixPoint([55, 119], [61, 119], t);
    state.nearKnee = [61, 100 + bend * 2];
    state.nearElbow = mixPoint([64, 62], [72, 74 - catchHand * 5], ease(u / 0.55));
    state.nearHand = mixPoint([63, 79], [81, 84 - catchHand * 10], ease(u / 0.5));
    state.farElbow = mixPoint([32, 62], [48, 72], t);
    state.farHand = mixPoint([33, 79], [57, 91], t);
    state.nearGesture = frame < 5 ? 'open' : 'grip'; state.farGesture = 'brace';
    state.gaze = 0; state.brow = -0.5;
  } else if (pose === 'turn') {
    // Eyes, then head, shoulder line, hips, finally a planted heel pivot.
    state.gaze = frame ? -1 : 1; state.turn = mix(0.45, -0.85, ease(u / 0.55));
    state.headX = -3 * ease(u / 0.55); state.lean = mix(1, -3, ease((u - 0.2) / 0.6));
    state.farElbow = mixPoint([32, 62], [30, 59], t); state.farHand = mixPoint([33, 79], [27, 75], t);
    state.nearElbow = mixPoint([64, 62], [58, 62], t); state.nearHand = mixPoint([63, 79], [50, 77], t);
    state.farFoot = mixPoint([41, 119], [38, 119], t); state.farKnee = [39, 98];
    state.headY = [0, -1, -1, 0, 0, 0, 0, 0][frame];
  } else if (pose === 'fold') {
    const fold = ease((u - 0.15) / 0.65);
    state.prop = 'map'; state.propT = fold;
    state.farElbow = [36, 64]; state.farHand = mixPoint([44, 68], [47, 72], fold);
    state.nearElbow = mixPoint([66, 65], [61, 68], fold);
    state.nearHand = mixPoint([67, 65], [55, 73], fold);
    state.farGesture = 'support'; state.nearGesture = 'pinch';
    state.headY = [1, 2, 3, 3, 3, 2, 1, 0][frame];
    state.gaze = frame > 5 ? 1 : 0; state.eyes = 0.8;
    state.mouth = -0.5; state.shoulderDrop = t;
  } else if (pose === 'doubt') {
    // Withhold the hand: the silhouette closes instead of reaching again.
    state.nearElbow = mixPoint([64, 62], [61, 63], t);
    state.nearHand = mixPoint([63, 79], [52, 79], t);
    state.farHand = mixPoint([33, 79], [37, 78], t);
    state.headX = -t; state.headY = [0, 1, 2, 2, 2, 1, 1, 1][frame];
    state.turn = mix(0.4, 0.05, t); state.gaze = frame < 3 ? 1 : -1;
    state.eyes = [1, 0.7, 0.35, 0, 0.5, 0.65, 0.65, 0.65][frame];
    state.brow = t; state.mouth = -t; state.shoulderDrop = 2 * t;
    state.nearGesture = 'closed';
  }
  return state;
}

function boot(d, p, foot, far, facing = 1) {
  const [x, y] = rounded(foot), toe = facing < 0 ? -1 : 1;
  const points = [[-4, -8], [3, -8], [4, -2], [7, 0], [7, 3], [-5, 3], [-5, -1]];
  d.poly(INK, points.map(([u, v]) => [x + u * toe, y + v]));
  d.poly(p.boot[far ? 1 : 2], [[-3, -7], [2, -7], [3, -1], [6, 1], [-4, 1]].map(([u, v]) => [x + u * toe, y + v]));
  d.line(p.boot[3], [x - 2 * toe, y - 6], [x + 2 * toe, y - 5]);
  d.line(p.boot[0], [x - 4 * toe, y + 2], [x + 6 * toe, y + 2]);
  d.dot(p.leather[2], x - 3 * toe, y);
}

function personLeg(d, p, hip, knee, foot, far, facing) {
  segment(d, hip, knee, 11, 8, p.pants, far);
  segment(d, knee, at(foot, 0, -5), 8, 6, p.pants, far);
  d.path(p.pants[0], [at(knee, -3, -2), at(knee, 1, 0), at(knee, 3, 2)]);
  if (!far) d.line(p.pants[3], at(knee, -2, -4), at(knee, 2, -3));
  boot(d, p, foot, far, facing);
}

function personArm(d, p, shoulder, elbow, wrist, identity, far) {
  const rolled = identity !== 'dutch';
  segment(d, shoulder, elbow, 10, 7, p.shirt, far);
  segment(d, elbow, wrist, rolled ? 6 : 7, 4, rolled ? p.skin : p.shirt, far);
  const cuff = rolled ? mixPoint(elbow, wrist, 0.12) : mixPoint(elbow, wrist, 0.86);
  const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1], length = Math.hypot(dx, dy) || 1;
  const cross = [-dy / length * 3, dx / length * 3];
  d.line(p.shirt[0], at(cuff, ...cross), at(cuff, -cross[0], -cross[1]), 3);
  d.line(p.shirt[3], at(cuff, ...cross), at(cuff, -cross[0], -cross[1]));
  d.line(p.shirt[1], at(elbow, -2, -3), at(elbow, 2, -1));
  if (rolled) d.dot(p.skin[1], ...mixPoint(elbow, wrist, 0.55));
  else d.dot('#b8a17c', cuff[0] + 1, cuff[1]);
}

function smallHand(d, p, point, gesture, far = false) {
  const [x, y] = rounded(point), skin = p.skin[far ? 2 : 3];
  if (gesture === 'brace') {
    d.poly(INK, [[x - 3, y - 3], [x + 1, y - 5], [x + 3, y - 3], [x + 3, y + 4], [x - 2, y + 4]]);
    d.rect(skin, x - 1, y - 3, 3, 6); d.line(p.skin[1], [x, y - 2], [x, y + 1]);
    d.rect(p.skin[2], x - 3, y, 2, 3);
  } else if (gesture === 'point') {
    d.rect(INK, x - 3, y - 2, 6, 6); d.rect(skin, x - 2, y - 1, 4, 4);
    d.line(INK, [x + 1, y - 2], [x + 6, y - 4], 3);
    d.line(skin, [x + 1, y - 2], [x + 6, y - 4]);
    d.dot(p.skin[1], x, y + 2);
  } else if (gesture === 'open' || gesture === 'support') {
    d.poly(INK, [[x - 4, y - 2], [x, y - 2], [x + 4, y - 4], [x + 5, y - 2], [x + 2, y + 3], [x - 4, y + 3]]);
    d.line(skin, [x - 3, y], [x + 2, y], 3);
    d.line(p.skin[2], [x + 1, y - 1], [x + 4, y - 3]);
    d.dot(p.skin[1], x + 1, y + 1);
  } else {
    d.poly(INK, [[x - 3, y - 3], [x + 2, y - 3], [x + 3, y], [x + 2, y + 4], [x - 2, y + 4], [x - 3, y + 1]]);
    d.rect(skin, x - 2, y - 2, 4, gesture === 'closed' ? 4 : 5);
    d.line(p.skin[1], [x, y + 1], [x + 2, y + 1]);
    if (gesture === 'pinch') { d.rect(p.skin[2], x + 1, y - 4, 2, 3); d.dot(INK, x + 1, y - 1); }
    if (gesture === 'grip') d.line(p.skin[0], [x - 1, y], [x + 1, y + 2]);
  }
}

function personTorso(d, p, s, identity) {
  const x = Math.round(s.cx + s.lean), sy = Math.round(s.shoulderY + s.shoulderDrop), hy = Math.round(s.hipY);
  const dutch = identity === 'dutch', camp = identity === 'camp';
  const left = camp ? 12 : 14, right = dutch ? 12 : 13;
  d.poly(INK, [[x - 6, sy - 5], [x + 6, sy - 5], [x + right, sy], [x + right - 1, sy + 14], [56, hy + 2], [36, hy + 2], [x - left, sy + 13], [x - left, sy]]);
  d.poly(p.shirt[2], [[x - 5, sy - 4], [x + 5, sy - 4], [x + right - 1, sy + 1], [x + right - 2, sy + 14], [55, hy], [37, hy], [x - left + 1, sy + 13], [x - left + 1, sy + 1]]);
  d.poly(p.shirt[1], [[x - left + 1, sy + 3], [x - 8, sy + 5], [x - 5, sy + 19], [42, hy], [37, hy], [x - left + 1, sy + 13]]);
  d.poly(p.shirt[3], [[x - 5, sy - 3], [x + 5, sy - 3], [x + 9, sy + 2], [x + 6, sy + 6], [x - 4, sy + 3]]);
  if (dutch || camp) {
    const v = p.vest;
    d.poly(v[0], [[x - 11, sy + 1], [x - 5, sy - 3], [x + 1, sy + 13], [x + 5, sy - 3], [x + 11, sy], [55, hy], [48, hy + 1], [45, hy - 3], [38, hy]]);
    d.poly(v[1], [[x - 10, sy + 2], [x - 6, sy], [x - 1, sy + 14], [46, hy - 3], [39, hy - 1]]);
    d.poly(v[2], [[x + 6, sy], [x + 10, sy + 2], [54, hy - 1], [49, hy - 1], [x + 2, sy + 15]]);
    d.path(v[3], [[x - 6, sy], [x - 2, sy + 12], [x + 1, sy + 14], [x + 6, sy]]);
    d.line(v[0], [x + 1, sy + 14], [49, hy - 3]);
    for (let y = sy + 16; y < hy - 3; y += 5) d.dot('#b29c79', 49, y);
    d.line(v[0], [x - 8, hy - 10], [x - 2, hy - 9]);
    if (dutch) {
      // A hanging watch chain, never a weapon belt or holster.
      d.path('#b79861', [[x + 2, hy - 12], [x + 5, hy - 8], [x + 8, hy - 7], [x + 11, hy - 10]]);
      d.dot('#e0c38a', x + 6, hy - 8); d.rect(v[0], x + 7, hy - 13, 5, 2);
    } else {
      d.rect(v[0], x - 10, sy + 12, 7, 7); d.rect(v[2], x - 9, sy + 13, 5, 4);
      d.dot(v[3], x - 7, sy + 13);
    }
  } else {
    // Blue work shirt: placket, pocket flaps and cloth tension over the back.
    d.line(p.shirt[0], [x + 3, sy + 7], [50, hy - 3]);
    d.line(p.shirt[3], [x + 4, sy + 8], [51, hy - 5]);
    for (let y = sy + 10; y < hy - 3; y += 6) d.dot('#c5bca0', x + 3, y);
    d.poly(p.shirt[1], [[x - 9, sy + 9], [x - 2, sy + 9], [x - 2, sy + 16], [x - 6, sy + 18], [x - 9, sy + 15]]);
    d.line(p.shirt[4], [x - 9, sy + 9], [x - 2, sy + 10]); d.dot('#b5b59c', x - 5, sy + 11);
    d.path(p.shirt[0], [[x - 9, sy + 20], [x - 4, sy + 22], [x - 2, sy + 24]]);
    d.line(p.shirt[3], [x - 8, sy + 21], [x - 4, sy + 23]);
    d.line(p.shirt[1], [x + 8, hy - 8], [x + 3, hy - 5]);
  }
  // Actual shirt collar, separate from the neck and the tie/scarf.
  d.poly(p.shirt[4], [[x - 5, sy - 4], [x, sy], [x - 3, sy + 5], [x - 7, sy - 1]]);
  d.poly(p.shirt[3], [[x + 1, sy], [x + 5, sy - 4], [x + 7, sy], [x + 4, sy + 4]]);
  if (dutch) {
    d.rect(p.accent[0], x - 1, sy - 2, 5, 4); d.rect(p.accent[1], x, sy - 1, 3, 3);
    d.poly(p.accent[1], [[x + 1, sy + 1], [x + 5, sy + 4], [x + 2, sy + 11], [x, sy + 9]]);
    d.line(p.accent[2], [x + 2, sy + 3], [x + 3, sy + 7]);
  } else if (camp) {
    d.rect(p.accent[1], x - 5, sy - 3, 10, 3);
    d.poly(p.accent[2], [[x - 4, sy], [x - 1, sy], [x - 3, sy + 7], [x - 6, sy + 4]]);
  }
  d.line(p.leather[0], [37, hy - 1], [56, hy - 1], 4);
  d.line(p.leather[2], [37, hy - 2], [56, hy - 2]);
  d.rect('#c1a475', 48, hy - 3, 5, 4); d.rect(p.leather[1], 49, hy - 2, 3, 2);
  d.texture(p.shirt[2], p.shirt[1], x - 12, sy, 25, hy - sy - 3, p.seed, 43);
  if (!dutch) {
    // A thick leather diagonal strap leads to a separately modelled satchel.
    d.line(p.leather[0], [x + 8, sy - 1], [37, hy - 1], 5);
    d.line(p.leather[2], [x + 8, sy - 1], [37, hy - 1], 3);
    d.line(p.leather[3], [x + 7, sy - 1], [36, hy - 1]);
    d.rect('#b9a17b', x + 1, sy + 12, 4, 4); d.rect(p.leather[1], x + 2, sy + 13, 2, 2);
    const bx = Math.round(34 + s.lean * 0.25), by = hy - 6;
    d.poly(INK, [[bx - 5, by], [bx + 6, by - 1], [bx + 8, by + 11], [bx + 5, by + 15], [bx - 6, by + 14]]);
    d.poly(p.leather[2], [[bx - 4, by + 1], [bx + 5, by], [bx + 6, by + 12], [bx + 4, by + 14], [bx - 5, by + 12]]);
    d.poly(p.leather[1], [[bx - 4, by + 1], [bx + 5, by], [bx + 5, by + 6], [bx, by + 9], [bx - 4, by + 6]]);
    d.path(p.leather[3], [[bx - 3, by + 2], [bx + 4, by + 1], [bx + 4, by + 5], [bx, by + 7]]);
    d.rect('#c7a371', bx, by + 6, 2, 3); d.dot(p.leather[0], bx, by + 7);
    d.line(p.leather[1], [bx - 3, by + 11], [bx + 2, by + 12]);
  }
}

function personHead(d, p, s, identity) {
  const x = Math.round(48 + s.lean * 0.55 + s.headX), y = Math.round(30 + s.headY);
  const dir = s.turn < -0.2 ? -1 : 1, profile = Math.abs(s.turn) > 0.65;
  const pt = (u, v) => [x + u * dir, y + v];
  const poly = (c, a) => d.poly(c, a.map(([u, v]) => pt(u, v)));
  const line = (c, a, b, w = 1) => d.line(c, pt(...a), pt(...b), w);
  const dot = (c, u, v) => d.dot(c, ...pt(u, v));
  const dutch = identity === 'dutch', camp = identity === 'camp';
  // Neck is long enough to leave adult shoulders below the jaw.
  poly(p.skin[0], [[-3, 7], [5, 7], [5, 14], [0, 17], [-4, 13]]);
  poly(p.skin[2], [[-2, 8], [4, 8], [3, 14], [0, 15], [-2, 12]]);
  poly(INK, [[-7, -8], [5, -8], [8, -3], [8, 1], [10, 3], [8, 5], [7, 10], [2, 12], [-5, 9], [-8, 3]]);
  poly(p.skin[2], [[-6, -7], [4, -7], [7, -3], [7, 1], [9, 3], [7, 4], [6, 9], [2, 10], [-4, 7], [-6, 2]]);
  poly(p.skin[3], [[0, -6], [5, -5], [6, -1], [5, 2], [8, 3], [5, 5], [5, 8], [2, 9], [0, 5]]);
  poly(p.skin[1], [[-6, -5], [-2, -3], [-2, 3], [0, 7], [-3, 7], [-6, 3]]);
  line(p.skin[4], [3, 3], [5, 3]); dot(p.skin[1], 7, 4);
  poly(p.hair[1], [[-7, -8], [5, -8], [5, -5], [-3, -5], [-4, 1], [-5, 5], [-7, 3]]);
  line(p.hair[2], [-6, -5], [-6, -1]);
  poly(p.skin[1], [[-6, -1], [-3, -2], [-2, 1], [-3, 4], [-5, 3]]);
  dot(p.skin[3], -4, 0); dot(p.skin[0], -4, 2);
  const eyeY = s.tilt > 1 ? 1 : 0, gaze = s.gaze < 0 ? 0 : 1;
  line(p.hair[0], [2, -2 + s.brow], [6, -2]);
  if (!profile) line(p.hair[1], [-1, -2], [0, -2 + s.brow]);
  line(p.skin[0], [2, eyeY], [6, eyeY]);
  if (s.eyes > 0.45) { dot(p.skin[4], 3, eyeY); dot(p.eye, 4 + gaze, eyeY); dot(INK, 4 + gaze, eyeY); }
  if (s.eyes > 0.8) dot(p.eye, 4, eyeY);
  if (!profile && s.eyes > 0.45) dot(INK, -1, eyeY);
  line(p.skin[1], [2, 2], [4, 2]);
  if (dutch) {
    poly(p.hair[0], [[0, 5], [3, 4], [7, 5], [8, 7], [5, 6], [3, 6], [1, 7], [-1, 6]]);
    poly(p.hair[1], [[-3, 5], [-1, 7], [2, 8], [6, 8], [5, 10], [1, 11], [-3, 8]]);
    dot(p.hair[2], 1, 9); line(p.skin[0], [2, 7], [5, 7 + Math.max(0, s.mouth)]);
  } else {
    poly(p.hair[2], [[-4, 4], [-1, 7], [3, 8], [7, 6], [6, 9], [2, 11], [-3, 8]]);
    for (const [u, v] of [[-3, 5], [-1, 8], [1, 9], [4, 9], [6, 7], [0, 7]]) dot(p.hair[0], u, v);
    line(p.skin[0], [2, 6], [6, 6 + Math.max(0, s.mouth)]);
    if (s.mouth < 0) dot(p.skin[1], 6, 7);
    if (camp) line(p.hair[3], [-3, 7], [1, 9]);
  }
  // Hat crown and thin band, with a separate occluding underside on the face.
  if (camp) {
    poly(INK, [[-11, -7], [-8, -13], [2, -15], [8, -10], [11, -7], [8, -4], [-9, -4]]);
    poly(p.hat[2], [[-9, -8], [-7, -12], [2, -13], [7, -10], [9, -7], [-8, -6]]);
    line(p.hat[3], [-7, -11], [1, -12]); line(p.hat[0], [-4, -6], [11, -6]);
    line(p.hat[1], [1, -12], [4, -8]);
  } else {
    poly(INK, [[-14, -7], [-10, -9], [-8, -17], [-3, -19], [1, -17], [6, -18], [9, -9], [15, -6], [16, -4], [8, -2], [-7, -3], [-15, -5]]);
    poly(p.hat[2], [[-9, -9], [-7, -16], [-3, -17], [1, -15], [5, -16], [7, -9], [5, -7], [-7, -7]]);
    poly(p.hat[1], [[-3, -17], [1, -15], [5, -16], [5, -10], [0, -10], [-1, -14]]);
    line(p.hat[3], [-7, -14], [-6, -10]); line(p.hat[3], [5, -14], [6, -10]);
    line(p.hat[0], [-8, -9], [7, -9], 2);
    line(dutch ? p.hat[3] : p.leather[2], [-7, -9], [6, -9]);
    dot(dutch ? '#ac9b7e' : p.hat[4], -5, -9);
    poly(p.hat[2], [[-14, -6], [-8, -8], [0, -6], [7, -8], [14, -5], [8, -4], [-6, -4]]);
    line(p.hat[3], [-13, -6], [-7, -7]); line(p.hat[3], [7, -7], [13, -5]);
    poly(p.hat[0], [[-6, -4], [8, -4], [13, -5], [8, -2], [-5, -3]]);
    if (!dutch) { dot(p.hat[4], -11, -6); dot(p.hat[4], 10, -5); dot(p.hat[3], -5, -15); }
  }
}

function paperMap(d, farHand, nearHand, fold, large = false) {
  const middle = mixPoint(farHand, nearHand, 0.5);
  const width = large ? mix(59, 22, fold) : mix(25, 9, fold);
  const height = large ? 25 : 11;
  const x = Math.round(middle[0] - width / 2), y = Math.round(middle[1] - height + (large ? 7 : 2));
  const w = Math.round(width), h = height;
  d.poly(PAPER[0], [[x - 1, y + 2], [x + w - 2, y - 3], [x + w + 2, y + h - 1], [x + 1, y + h + 3]]);
  d.poly(PAPER[2], [[x, y + 3], [x + w - 3, y - 2], [x + w, y + h - 2], [x + 2, y + h + 1]]);
  const crease = Math.round(x + w * (0.52 + fold * 0.23));
  d.poly(PAPER[3], [[crease, y + 1], [x + w - 3, y - 2], [x + w, y + h - 2], [crease + 1, y + h]]);
  d.line(PAPER[1], [crease, y + 2], [crease + 1, y + h - 1]);
  if (fold < 0.8) {
    d.path('#7d8c89', [[x + 4, y + 5], [x + w * 0.28, y + 4], [x + w * 0.4, y + 7], [x + w * 0.6, y + 4], [x + w - 4, y + 3]]);
    for (let i = 0; i < (large ? 7 : 3); i++) {
      const px = x + 4 + i * (large ? 6 : 4), py = y + h - 4 - (i % 3);
      if (px < x + w - 4) d.line('#9e7a57', [px, py], [px + 1, py]);
    }
    if (large) d.path('#a38b63', [[x + 10, y + 13], [x + 13, y + 9], [x + 16, y + 12], [x + 19, y + 8], [x + 22, y + 11]]);
  } else {
    d.line(PAPER[0], [x + 3, y + h - 1], [x + w - 1, y + h - 3]);
    d.line(PAPER[1], [x + 3, y + h - 3], [x + w - 2, y + h - 5]);
  }
}

function drawPerson(d, identity, pose, frame, drawProps = true) {
  const p = PALETTES[identity], s = personState(identity, pose, frame);
  const farShoulder = [s.cx + s.lean - 11, s.shoulderY + 2 + s.shoulderDrop];
  const nearShoulder = [s.cx + s.lean + 10, s.shoulderY + 2 + s.shoulderDrop];
  personLeg(d, p, [42, s.hipY], s.farKnee, s.farFoot, true, pose === 'turn' && frame > 3 ? -1 : 1);
  personArm(d, p, farShoulder, s.farElbow, s.farHand, identity, true);
  personLeg(d, p, [52, s.hipY], s.nearKnee, s.nearFoot, false, 1);
  personTorso(d, p, s, identity);
  personHead(d, p, s, identity);
  personArm(d, p, nearShoulder, s.nearElbow, s.nearHand, identity, false);
  if (s.prop && drawProps) paperMap(d, s.farHand, s.nearHand, s.propT);
  smallHand(d, p, s.farHand, s.farGesture, true);
  smallHand(d, p, s.nearHand, s.nearGesture);
}

// ---------------- Independent portrait drawings (192 x 224) ----------------
// Separate facial topology: ~51 px jaw, 33 px neck, 108 px shoulder span.
// This deliberately does NOT call drawPerson/personHead or scale an image.
function portraitState(identity, pose, frame) {
  const u = frame / 7, t = ease(u), dutch = identity === 'dutch';
  const s = {
    x: 92, y: 67, tilt: 0, face: 0.32, gaze: 1, eyelid: 1, brow: 0,
    mouth: 0, shoulder: 0, lean: dutch ? -2 : 0,
    leftElbow: [38, 181], leftHand: [54, 204], rightElbow: [147, 180], rightHand: [137, 203],
    leftGesture: 'rest', rightGesture: 'rest', paper: false, fold: 0,
  };
  switch (pose) {
    case 'idle':
      s.y += [0, 0, -1, -1, -1, 0, 0, 0][frame];
      s.shoulder = [0, 0, 0, -1, -1, -1, 0, 0][frame];
      s.eyelid = [1, 1, 1, 1, 0.55, 0, 0.85, 1][frame];
      if (dutch) { s.leftElbow = [35, 178]; s.leftHand = [59, 193]; }
      break;
    case 'walk': {
      const contact = PERSON_WALK[frame];
      s.shoulder = contact.bob; s.y += contact.bob; s.lean += contact.swing * 0.25;
      s.leftElbow[0] -= contact.swing; s.leftHand[0] -= contact.swing * 1.4;
      s.rightElbow[0] += contact.swing; s.rightHand[0] += contact.swing * 1.4;
      break;
    }
    case 'listen':
      s.tilt = [0, 0, 1, 3, 3, 2, 1, 1][frame]; s.y += s.tilt;
      s.face = mix(0.2, 0.5, t); s.brow = -0.3;
      s.eyelid = [1, 1, 0.65, 0.55, 0.8, 1, 1, 1][frame];
      s.rightHand = mixPoint([137, 203], [121, 193], t);
      break;
    case 'point': {
      const reach = ease((u - 0.12) / 0.64);
      s.rightElbow = mixPoint([147, 180], [146, 136], reach);
      s.rightHand = mixPoint([137, 203], [165, 106], reach);
      s.rightGesture = reach > 0.55 ? 'point' : 'rest';
      s.face = mix(0.32, 0.7, t); s.x += t * 3; s.y -= t * 2;
      s.brow = -0.8; s.mouth = [0, 0, 1, 2, 1, 1, 0, 0][frame];
      s.leftHand = mixPoint([54, 204], [66, 186], t);
      break;
    }
    case 'offer': {
      const reach = ease((u - 0.1) / 0.75);
      s.leftElbow = mixPoint([40, 178], [69, 177], reach);
      s.leftHand = mixPoint([73, 183], [113, 165], reach);
      s.rightElbow = mixPoint([143, 179], [153, 177], reach);
      s.rightHand = mixPoint([118, 179], [160, 157], reach);
      s.paper = true; s.leftGesture = 'support'; s.rightGesture = 'pinch';
      s.face = mix(0.3, 0.6, t); s.y -= t * 2; s.brow = -0.6;
      s.mouth = [0, 1, 2, 1, 1, 0, 0, 0][frame];
      break;
    }
    case 'accept': {
      const reach = ease(u / 0.5), back = ease((u - 0.55) / 0.45);
      s.rightElbow = mixPoint([147, 180], [150, 175], reach);
      s.rightHand = mixPoint(mixPoint([137, 203], [161, 163], reach), [117, 185], back);
      s.leftElbow = mixPoint([38, 181], [54, 182], reach);
      s.leftHand = mixPoint(mixPoint([54, 204], [119, 169], reach), [78, 189], back);
      s.paper = frame >= 3; s.leftGesture = 'support'; s.rightGesture = frame >= 3 ? 'pinch' : 'open';
      s.tilt = [0, 0, 1, 2, 4, 4, 3, 3][frame]; s.y += s.tilt;
      s.gaze = frame > 3 ? 0 : 1;
      break;
    }
    case 'push': {
      const load = ease(u / 0.65), drive = ease((u - 0.5) / 0.5);
      s.lean += load * 9; s.x += load * 9; s.y += load * 12 - drive * 3;
      s.shoulder = load * 10 - drive * 2; s.tilt = load * 4;
      s.leftElbow = mixPoint([38, 181], [94, 182], load);
      s.leftHand = mixPoint([54, 204], [150, 147], load);
      s.rightElbow = mixPoint([147, 180], [149, 182], load);
      s.rightHand = mixPoint([137, 203], [174, 160], load);
      s.leftGesture = s.rightGesture = load > 0.3 ? 'brace' : 'rest';
      s.brow = load; s.mouth = -load; s.eyelid = 1 - load * 0.4;
      break;
    }
    case 'help': {
      const bend = [0, 0.2, 0.6, 1, 1, 0.85, 0.6, 0.4][frame];
      const reach = ease(u / 0.5), pull = ease((u - 0.55) / 0.45);
      s.lean += bend * 5; s.x += bend * 5; s.y += bend * 9; s.tilt = bend * 4;
      s.rightElbow = mixPoint([147, 180], [150, 177 - pull * 5], reach);
      s.rightHand = mixPoint([137, 203], [168, 199 - pull * 22], reach);
      s.leftHand = mixPoint([54, 204], [91, 199], t);
      s.rightGesture = frame < 5 ? 'open' : 'grip'; s.gaze = 0; s.brow = -0.4;
      break;
    }
    case 'turn':
      s.gaze = frame ? -1 : 1; s.face = mix(0.35, -0.85, ease(u / 0.58));
      s.x -= 8 * ease(u / 0.58); s.lean = mix(0, -8, ease((u - 0.2) / 0.7));
      s.leftElbow = mixPoint([38, 181], [33, 177], t); s.leftHand = mixPoint([54, 204], [41, 194], t);
      s.rightHand = mixPoint([137, 203], [120, 199], t);
      s.y += [0, -1, -2, -1, 0, 0, 0, 0][frame];
      break;
    case 'fold':
      s.paper = true; s.fold = ease((u - 0.15) / 0.65);
      s.leftElbow = [43, 180]; s.rightElbow = [143, 180];
      s.leftHand = mixPoint([76, 179], [84, 188], s.fold);
      s.rightHand = mixPoint([123, 173], [104, 191], s.fold);
      s.leftGesture = 'support'; s.rightGesture = 'pinch';
      s.tilt = [1, 3, 4, 5, 5, 3, 1, 0][frame]; s.y += s.tilt;
      s.gaze = frame > 5 ? 1 : 0; s.mouth = -0.7; s.eyelid = 0.8;
      break;
    case 'doubt':
      s.x -= t * 2; s.face = mix(0.32, 0.02, t);
      s.tilt = [0, 1, 2, 3, 3, 2, 2, 2][frame]; s.y += s.tilt;
      s.eyelid = [1, 0.65, 0.25, 0, 0.5, 0.65, 0.65, 0.65][frame];
      s.gaze = frame < 3 ? 1 : -1; s.brow = t; s.mouth = -t;
      s.shoulder = t * 3; s.rightHand = mixPoint([137, 203], [109, 198], t);
      s.rightGesture = 'closed'; s.leftHand = mixPoint([54, 204], [64, 203], t);
      break;
    default: throw new Error(`Unknown portrait pose: ${pose}`);
  }
  return s;
}

function portraitCoat(d, p, s, identity) {
  const dutch = identity === 'dutch', x = Math.round(94 + s.lean), y = Math.round(126 + s.shoulder);
  d.poly(INK, [[x - 20, y - 10], [x + 16, y - 11], [x + 37, y - 2], [x + 52, y + 10], [x + 52, 205], [130, 215], [62, 215], [x - 50, 204], [x - 52, y + 12], [x - 39, y]]);
  d.poly(p.shirt[2], [[x - 19, y - 8], [x + 15, y - 9], [x + 36, y], [x + 49, y + 12], [x + 49, 203], [129, 213], [63, 213], [x - 47, 202], [x - 49, y + 13], [x - 37, y + 2]]);
  d.poly(p.shirt[1], [[x - 47, y + 13], [x - 32, y + 7], [x - 19, y + 22], [x - 22, 208], [63, 213], [x - 47, 202]]);
  d.poly(p.shirt[3], [[x - 18, y - 7], [x + 15, y - 8], [x + 37, y + 5], [x + 32, y + 14], [x + 10, y + 11], [x - 15, y + 3]]);
  if (dutch) {
    d.poly(p.vest[0], [[x - 34, y + 2], [x - 20, y - 7], [x, y + 39], [x + 17, y - 8], [x + 34, y + 2], [x + 37, 208], [108, 214], [94, 206], [79, 214], [x - 36, 207]]);
    d.poly(p.vest[1], [[x - 32, y + 4], [x - 22, y - 2], [x - 4, y + 39], [94, 203], [79, 211], [x - 33, 205]]);
    d.poly(p.vest[2], [[x + 19, y - 3], [x + 31, y + 4], [x + 34, 205], [109, 211], [98, 203], [x + 2, y + 40]]);
    d.path(p.vest[3], [[x - 21, y], [x - 7, y + 35], [x, y + 40], [x + 19, y - 2]]);
    d.line(p.vest[0], [x + 1, y + 40], [98, 204], 2);
    for (let i = 0; i < 4; i++) {
      const by = y + 44 + i * 9;
      if (by < 207) { d.oval('#ad9671', x + 3, by, 2, 2); d.dot('#e4c991', x + 2, by - 1); d.dot(p.vest[0], x + 3, by); }
    }
    d.line(p.vest[0], [x + 15, y + 41], [x + 30, y + 40], 3);
    d.line(p.vest[3], [x + 15, y + 40], [x + 30, y + 39]);
    d.path('#766044', [[x + 4, y + 50], [x + 9, y + 60], [x + 17, y + 63], [x + 25, y + 57], [x + 28, y + 43]], 2);
    d.path('#c7aa70', [[x + 4, y + 49], [x + 9, y + 59], [x + 17, y + 62], [x + 24, y + 56], [x + 27, y + 43]]);
    for (const [u, v] of [[6, 54], [11, 60], [17, 61], [22, 57], [26, 50]]) d.dot('#eed8a2', x + u, y + v);
    // A small crimson pocket edge echoes the neckerchief, not a bright vest.
    d.poly(p.accent[1], [[x + 17, y + 38], [x + 20, y + 33], [x + 23, y + 37], [x + 26, y + 34], [x + 28, y + 38]]);
  } else {
    d.line(p.shirt[0], [x + 5, y + 17], [100, 210], 3);
    d.line(p.shirt[3], [x + 7, y + 18], [102, 210]);
    for (let i = 0; i < 6; i++) {
      const by = y + 23 + i * 12;
      if (by < 210) { d.rect('#b6b6a4', x + 4, by, 3, 3); d.dot(p.shirt[0], x + 5, by + 1); }
    }
    for (const offset of [-24, 18]) {
      d.poly(p.shirt[0], [[x + offset - 9, y + 28], [x + offset + 8, y + 28], [x + offset + 7, y + 48], [x + offset, y + 52], [x + offset - 9, y + 47]]);
      d.poly(p.shirt[2], [[x + offset - 7, y + 30], [x + offset + 6, y + 30], [x + offset + 5, y + 46], [x + offset, y + 49], [x + offset - 7, y + 45]]);
      d.poly(p.shirt[3], [[x + offset - 8, y + 28], [x + offset + 7, y + 28], [x + offset + 6, y + 33], [x + offset, y + 36], [x + offset - 8, y + 32]]);
      d.rect('#bbbba4', x + offset - 1, y + 31, 2, 2);
    }
    d.path(p.shirt[1], [[x - 30, y + 56], [x - 16, y + 61], [x - 8, y + 60]]);
    d.path(p.shirt[3], [[x - 29, y + 58], [x - 17, y + 63], [x - 12, y + 62]]);
    d.path(p.shirt[0], [[x + 32, y + 56], [x + 23, y + 63], [x + 17, y + 62]]);
  }
  // Collar tips are larger, folded polygons with shaded undersides.
  d.poly(p.shirt[0], [[x - 18, y - 9], [x - 2, y + 5], [x - 12, y + 23], [x - 26, y + 2]]);
  d.poly(p.shirt[4], [[x - 17, y - 7], [x - 4, y + 5], [x - 12, y + 18], [x - 23, y + 2]]);
  d.poly(p.shirt[0], [[x + 1, y + 5], [x + 17, y - 10], [x + 26, y + 1], [x + 12, y + 22]]);
  d.poly(p.shirt[3], [[x + 4, y + 5], [x + 17, y - 7], [x + 23, y + 1], [x + 12, y + 18]]);
  if (dutch) {
    d.poly(p.accent[0], [[x - 9, y - 7], [x + 11, y - 8], [x + 10, y], [x + 4, y + 7], [x - 3, y + 6], [x - 10, y - 1]]);
    d.poly(p.accent[1], [[x - 8, y - 6], [x + 9, y - 6], [x + 7, y - 1], [x, y + 3], [x - 8, y - 1]]);
    d.poly(p.accent[1], [[x + 1, y + 4], [x + 9, y + 8], [x + 7, y + 30], [x + 1, y + 26], [x - 2, y + 11]]);
    d.path(p.accent[2], [[x + 2, y + 6], [x + 5, y + 12], [x + 4, y + 24]], 2);
    d.line(p.accent[0], [x + 6, y + 11], [x + 7, y + 21]);
  } else {
    d.line(p.leather[0], [x + 29, y - 1], [x - 37, 214], 11);
    d.line(p.leather[2], [x + 29, y - 1], [x - 37, 213], 7);
    d.line(p.leather[3], [x + 26, y], [x - 40, 212]);
    d.line(p.leather[1], [x + 31, y + 1], [x - 35, 212]);
    for (let i = 0; i < 8; i++) {
      const point = mixPoint([x + 27, y + 4], [x - 36, 209], i / 8);
      d.dot('#b69563', ...point);
    }
    const buckle = mixPoint([x + 29, y - 1], [x - 37, 213], 0.34);
    d.poly('#d0b181', [at(buckle, -5, -6), at(buckle, 4, -1), at(buckle, 0, 6), at(buckle, -9, 1)]);
    d.poly(p.leather[1], [at(buckle, -4, -3), at(buckle, 1, 0), at(buckle, -1, 3), at(buckle, -6, 0)]);
    d.line('#aa8d60', at(buckle, -5, 0), at(buckle, 0, 2));
  }
  d.texture(dutch ? p.vest[1] : p.shirt[2], dutch ? p.vest[2] : p.shirt[1], x - 38, y + 5, 77, 73, p.seed ^ 0x434c4f54, 61);
}

function portraitArm(d, p, shoulder, elbow, wrist, identity, far) {
  segment(d, shoulder, elbow, 27, 19, p.shirt, far);
  const rolled = identity === 'arthur';
  segment(d, elbow, wrist, rolled ? 16 : 18, 10, rolled ? p.skin : p.shirt, far);
  const cuff = mixPoint(elbow, wrist, rolled ? 0.16 : 0.83);
  const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1], length = Math.hypot(dx, dy) || 1;
  const normal = [-dy / length, dx / length];
  d.line(p.shirt[0], at(cuff, normal[0] * 9, normal[1] * 9), at(cuff, -normal[0] * 9, -normal[1] * 9), 6);
  d.line(p.shirt[3], at(cuff, normal[0] * 8, normal[1] * 8), at(cuff, -normal[0] * 8, -normal[1] * 8), 3);
  d.line(p.shirt[4], at(cuff, normal[0] * 7 - 1, normal[1] * 7 - 1), at(cuff, -normal[0] * 5 - 1, -normal[1] * 5 - 1));
  d.path(p.shirt[1], [at(elbow, -7, -7), at(elbow, -1, -4), at(elbow, 6, -5)], 2);
  d.line(p.shirt[3], at(elbow, -5, -6), at(elbow, 1, -3));
  if (rolled) {
    const muscle = mixPoint(elbow, wrist, 0.52);
    d.line(p.skin[1], at(muscle, -3, -2), at(muscle, 0, 4));
    d.line(p.skin[4], at(muscle, 2, -2), at(muscle, 3, 3));
    for (const [u, v] of [[-3, -1], [-1, 4], [1, 1]]) d.dot(p.skin[0], muscle[0] + u, muscle[1] + v);
  } else {
    d.rect('#9f8764', cuff[0] - 1, cuff[1] - 1, 3, 3); d.dot('#e6cb93', cuff[0], cuff[1] - 1);
  }
}

function portraitHand(d, p, hand, gesture, far = false) {
  const [x, y] = rounded(hand), main = p.skin[far ? 2 : 3];
  const poly = (color, points) => d.poly(color, points.map(([u, v]) => [x + u, y + v]));
  const line = (color, a, b, width = 1) => d.line(color, at(a, x, y), at(b, x, y), width);
  if (gesture === 'brace') {
    poly(INK, [[-7, 8], [-7, -2], [-4, -5], [-3, -12], [0, -13], [2, -11], [4, -12], [6, -9], [7, 5], [3, 11], [-3, 12]]);
    poly(main, [[-5, 7], [-5, -1], [-2, -4], [-2, -10], [0, -11], [1, -3], [3, -10], [4, -8], [5, 5], [2, 9], [-2, 10]]);
    line(p.skin[1], [1, -3], [2, 5]); line(p.skin[1], [-2, -2], [-1, 4]);
    line(p.skin[4], [-3, 5], [0, 7]);
  } else if (gesture === 'point') {
    poly(INK, [[-7, 6], [-7, -3], [-3, -6], [3, -5], [9, -14], [12, -15], [14, -12], [8, -2], [5, 6], [1, 10]]);
    poly(main, [[-5, 5], [-5, -2], [-2, -4], [4, -3], [10, -12], [12, -12], [6, -1], [3, 5], [0, 8]]);
    line(p.skin[1], [0, -2], [3, 1]); line(p.skin[1], [-2, 1], [2, 4]);
    line(p.skin[4], [7, -5], [10, -9]);
  } else if (gesture === 'open' || gesture === 'support') {
    poly(INK, [[-9, -2], [-3, -4], [4, -3], [8, -9], [11, -9], [11, -6], [7, 1], [11, 0], [13, 2], [8, 7], [1, 10], [-7, 7]]);
    poly(main, [[-7, -1], [-2, -2], [4, -1], [9, -7], [9, -5], [5, 2], [10, 2], [7, 5], [0, 8], [-6, 5]]);
    line(p.skin[1], [-3, 1], [3, 3]); line(p.skin[1], [-1, 5], [5, 4]);
    line(p.skin[4], [-4, -1], [1, 0]); line(p.skin[2], [7, 2], [6, 4]);
  } else {
    poly(INK, [[-7, -5], [-3, -8], [4, -7], [8, -2], [7, 7], [3, 10], [-4, 9], [-8, 4]]);
    poly(main, [[-5, -4], [-2, -6], [3, -5], [6, -1], [5, 6], [2, 8], [-3, 7], [-6, 3]]);
    line(p.skin[1], [-3, -2], [3, 0]); line(p.skin[1], [-3, 1], [3, 3]);
    line(p.skin[1], [-2, 4], [2, 6]);
    poly(p.skin[2], [[-6, -1], [-2, -2], [1, 2], [-2, 4], [-5, 3]]);
    line(p.skin[4], [-4, -4], [0, -4]);
    if (gesture === 'pinch') {
      poly(p.skin[2], [[2, -4], [4, -11], [7, -12], [8, -9], [6, -2]]);
      line(p.skin[4], [5, -10], [6, -10]); line(p.skin[0], [3, -1], [6, -1]);
    }
    if (gesture === 'grip' || gesture === 'closed') line(p.skin[0], [-1, 0], [3, 2], 2);
  }
  // Knuckle and tendon accents are fixed anatomy, not frame-noise sparkles.
  if (gesture !== 'point') d.dot(p.skin[4], x - 3, y - 1);
}

function portraitHead(d, p, s, identity) {
  const x = Math.round(s.x), y = Math.round(s.y), dir = s.face < -0.18 ? -1 : 1;
  const profile = Math.abs(s.face) > 0.62, dutch = identity === 'dutch';
  // Continuous narrowing near profile; no sprite flip / eye swap shortcut.
  const narrow = 1 - Math.max(0, Math.abs(s.face) - 0.3) * 0.2;
  const point = (u, v) => [Math.round(x + u * dir * narrow), Math.round(y + v + u * s.tilt * 0.018)];
  const poly = (c, vertices) => d.poly(c, vertices.map(([u, v]) => point(u, v)));
  const line = (c, a, b, width = 1) => d.line(c, point(...a), point(...b), width);
  const dot = (c, u, v) => d.dot(c, ...point(u, v));
  // Neck/collarbone and a shadow cast by the jaw.
  poly(INK, [[-16, 33], [15, 33], [17, 52], [9, 61], [-3, 63], [-19, 53]]);
  poly(p.skin[2], [[-14, 34], [13, 35], [15, 51], [8, 58], [-3, 60], [-16, 52]]);
  poly(p.skin[0], [[-14, 35], [13, 36], [11, 46], [1, 51], [-12, 45]]);
  poly(p.skin[3], [[5, 46], [12, 41], [13, 51], [7, 57], [2, 58]]);
  line(p.skin[1], [-10, 45], [-5, 55]); line(p.skin[4], [8, 49], [9, 53]);
  // Angular adult skull with a distinct brow, cheek plane and square jaw.
  poly(INK, [[-24, -22], [-15, -29], [9, -29], [21, -21], [25, -8], [26, 1], [31, 9], [26, 13], [25, 27], [18, 37], [4, 43], [-12, 38], [-22, 25], [-27, 8]]);
  poly(p.skin[2], [[-22, -20], [-14, -27], [8, -27], [19, -20], [23, -7], [23, 2], [28, 9], [24, 11], [23, 26], [16, 35], [4, 40], [-11, 36], [-20, 24], [-24, 8]]);
  poly(p.skin[1], [[-21, -18], [-10, -20], [-9, -7], [-12, 5], [-8, 17], [-5, 29], [4, 37], [-10, 35], [-19, 22], [-22, 9]]);
  poly(p.skin[3], [[-4, -24], [9, -25], [18, -18], [20, -5], [15, 0], [19, 7], [24, 10], [20, 13], [21, 23], [14, 33], [5, 36], [-1, 28], [1, 15], [-4, 6]]);
  poly(p.skin[4], [[3, -22], [10, -21], [15, -17], [16, -11], [9, -9], [2, -12]]);
  poly(p.skin[4], [[10, 9], [16, 6], [21, 10], [17, 13], [10, 14], [6, 12]]);
  poly(p.skin[1], [[-8, 11], [-2, 8], [2, 13], [0, 19], [-5, 21], [-10, 17]]);
  // Separate ear helix, hairline and several stable locks at the nape.
  poly(p.hair[0], [[-25, -23], [-15, -30], [9, -29], [18, -24], [18, -17], [9, -19], [2, -18], [-7, -21], [-16, -14], [-18, 6], [-20, 17], [-25, 12], [-28, 1]]);
  poly(p.hair[1], [[-23, -22], [-15, -27], [-9, -25], [-13, -17], [-18, -12], [-20, 2], [-23, 8], [-25, -1]]);
  for (const [u, v] of [[-21, -19], [-18, -23], [-23, -12], [-22, -7], [-24, 3], [-20, 12]]) line(p.hair[2], [u, v], [u + 1, v + 4]);
  poly(p.skin[0], [[-23, 0], [-18, -2], [-14, 1], [-13, 10], [-17, 17], [-22, 13], [-25, 6]]);
  poly(p.skin[2], [[-22, 1], [-18, 0], [-16, 3], [-16, 10], [-18, 14], [-21, 11], [-23, 6]]);
  line(p.skin[3], [-21, 2], [-18, 2]); line(p.skin[0], [-19, 4], [-20, 9]); dot(p.skin[1], -18, 11);
  // Brow/eyelid anatomy; expression changes the angles, not whole-head bob.
  const brow = Math.round(s.brow * 2), eyeY = 1 + Math.round(s.tilt * 0.2);
  line(p.skin[1], [-2, -8], [6, -9]); line(p.skin[1], [9, -9], [17, -8]);
  poly(p.hair[0], [[3, -5 + brow], [9, -7 + brow], [16, -6], [20, -3], [17, -2], [10, -4 + brow], [4, -2 + brow]]);
  line(p.hair[2], [6, -5 + brow], [13, -5]);
  if (!profile) {
    poly(p.hair[1], [[-13, -4], [-9, -6], [-3, -5 + brow], [-1, -2 + brow], [-8, -3], [-12, -2]]);
  }
  const open = s.eyelid > 0.1, lid = Math.round((1 - s.eyelid) * 3);
  poly(p.skin[0], [[3, eyeY], [7, eyeY - 2], [14, eyeY - 2], [18, eyeY], [15, eyeY + 3], [8, eyeY + 4]]);
  if (open) {
    poly('#d8cdb6', [[5, eyeY + lid], [8, eyeY - 1 + lid], [14, eyeY - 1 + lid], [16, eyeY + 1], [13, eyeY + 2], [8, eyeY + 2]]);
    const pupil = s.gaze < 0 ? 9 : s.gaze === 0 ? 11 : 13;
    if (lid < 3) {
      line(p.eye, [pupil - 1, eyeY + lid], [pupil - 1, eyeY + 2], 2);
      line(INK, [pupil, eyeY + lid], [pupil, eyeY + 2]);
      if (s.eyelid > 0.7) dot('#ece0c4', pupil - 1, eyeY);
    }
  }
  line(p.skin[0], [4, eyeY + lid], [10, eyeY - 1 + lid]);
  line(p.skin[0], [10, eyeY - 1 + lid], [17, eyeY + lid]);
  line(p.skin[1], [7, eyeY + 5], [14, eyeY + 5]);
  line(p.skin[1], [18, eyeY + 2], [21, eyeY + 4]);
  if (!profile) {
    line(p.skin[0], [-12, eyeY], [-4, eyeY]);
    if (open && lid < 2) { line('#c6baa5', [-10, eyeY + 1], [-5, eyeY + 1]); dot(INK, s.gaze < 0 ? -10 : -6, eyeY + 1); }
    line(p.skin[1], [-11, eyeY + 4], [-5, eyeY + 4]);
  }
  // Nose bridge, lit tip, nostril and philtrum are separate pixel clusters.
  poly(p.skin[1], [[0, 0], [3, -1], [4, 9], [9, 13], [7, 16], [0, 15], [-2, 12]]);
  poly(p.skin[3], [[3, 0], [5, 0], [6, 8], [10, 12], [7, 14], [3, 12]]);
  line(p.skin[4], [5, 6], [7, 11]); line(p.skin[0], [1, 14], [4, 15]);
  dot(p.skin[0], 8, 14); line(p.skin[1], [5, 17], [6, 19]);
  line(p.skin[1], [17, 15], [20, 21]);
  if (dutch) {
    // Broad divided moustache, curled ends, dark jaw and small chin tuft.
    poly(p.hair[0], [[-4, 20], [1, 17], [6, 18], [11, 17], [17, 19], [21, 24], [18, 26], [13, 23], [8, 22], [4, 23], [-1, 24], [-6, 23]]);
    line(p.hair[2], [-2, 20], [3, 19]); line(p.hair[1], [10, 19], [16, 20]);
    line(p.hair[2], [16, 22], [19, 24]); line(p.hair[1], [-3, 22], [2, 21]);
    poly(p.hair[0], [[-16, 17], [-12, 21], [-10, 30], [-2, 35], [7, 37], [15, 32], [20, 27], [18, 35], [5, 41], [-7, 37], [-15, 29]]);
    poly(p.hair[1], [[-12, 23], [-9, 29], [-2, 34], [6, 37], [3, 39], [-6, 35], [-12, 29]]);
    poly(p.hair[0], [[3, 29], [10, 28], [11, 32], [8, 35], [4, 34]]);
    for (const [u, v] of [[-12, 26], [-7, 32], [-2, 35], [9, 36], [15, 32]]) line(p.hair[2], [u, v], [u + 1, v + 2]);
  } else {
    // Brown stubble follows jaw planes; it is not a solid black beard mask.
    poly(p.hair[2], [[-16, 18], [-11, 23], [-7, 29], [0, 34], [10, 34], [18, 28], [22, 23], [20, 32], [7, 40], [-7, 35], [-15, 27]]);
    poly(p.skin[1], [[-10, 23], [-5, 25], [0, 30], [10, 31], [17, 27], [16, 32], [7, 36], [-2, 33], [-9, 28]]);
    for (const [u, v] of [[-14, 21], [-12, 25], [-9, 29], [-5, 32], [-1, 35], [3, 37], [7, 37], [12, 34], [16, 31], [19, 27], [-6, 27], [1, 32], [9, 33], [14, 30]]) {
      dot(p.hair[0], u, v); if ((u & 1) === 0) dot(p.hair[1], u, v + 1);
    }
    line(p.hair[1], [-1, 20], [5, 19]); line(p.hair[2], [8, 20], [14, 21]);
    // Two short forehead creases and a sun-worn cheek, no copied scar texture.
    line(p.skin[1], [-4, -16], [3, -17]); line(p.skin[2], [7, -17], [13, -16]);
    line(p.skin[1], [17, 8], [20, 7]);
  }
  const mouthY = 25 + Math.round(s.tilt * 0.15), speaking = Math.max(0, Math.round(s.mouth));
  line(p.skin[0], [1, mouthY], [8, mouthY + speaking], speaking > 0 ? 2 : 1);
  line(p.skin[0], [8, mouthY + speaking], [15, mouthY + (s.mouth < 0 ? 1 : 0)]);
  if (speaking > 0) line('#a07865', [5, mouthY + speaking + 2], [11, mouthY + speaking + 2]);
  else line(p.skin[3], [4, mouthY + 2], [10, mouthY + 2]);
  if (s.mouth < 0) { dot(p.skin[1], 16, mouthY + 2); line(p.skin[1], [1, 30], [4, 31]); }
  // Face shading is stable in local coordinates and intentionally sparse.
  for (const [u, v] of [[-7, 14], [-5, 17], [-9, 20], [17, 12], [19, 15]]) dot(p.skin[1], u, v);
  // Wide brim and high-resolution dented crown, independent of small hat art.
  poly(INK, [[-47, -22], [-36, -27], [-29, -47], [-18, -52], [-6, -48], [8, -50], [21, -46], [29, -27], [43, -22], [49, -17], [44, -11], [23, -6], [-3, -8], [-28, -11], [-46, -15]]);
  poly(p.hat[2], [[-30, -27], [-27, -44], [-18, -49], [-7, -45], [7, -47], [19, -43], [25, -26], [18, -22], [-20, -22]]);
  poly(p.hat[1], [[-17, -48], [-7, -44], [7, -46], [17, -42], [15, -31], [5, -32], [-1, -37], [-8, -32], [-19, -32]]);
  poly(p.hat[3], [[-26, -41], [-21, -44], [-20, -34], [-23, -28], [-28, -27]]);
  line(p.hat[3], [18, -41], [22, -30]); line(p.hat[0], [-18, -46], [-9, -42]);
  line(p.hat[0], [-29, -26], [24, -26], 4);
  line(dutch ? p.hat[3] : p.leather[2], [-28, -26], [23, -26]);
  poly('#bba582', [[-22, -28], [-17, -28], [-17, -23], [-22, -23]]);
  poly(p.hat[0], [[-21, -27], [-18, -27], [-18, -24], [-21, -24]]);
  poly(p.hat[2], [[-45, -21], [-29, -25], [-12, -21], [5, -21], [25, -25], [41, -20], [46, -17], [24, -12], [1, -13], [-26, -15], [-44, -17]]);
  poly(p.hat[3], [[-43, -21], [-29, -24], [-17, -22], [-24, -20], [-39, -18]]);
  line(p.hat[3], [26, -23], [42, -18]);
  // The underside occludes the forehead: no white outline halo over the eyes.
  poly(p.hat[0], [[-28, -15], [-2, -13], [23, -12], [44, -16], [39, -11], [22, -7], [1, -9], [-23, -11]]);
  line(p.hat[1], [-20, -13], [2, -11]);
  if (!dutch) {
    for (const [u, v] of [[-40, -20], [-34, -22], [-24, -40], [-19, -46], [33, -21], [40, -18], [-12, -23]]) line(p.hat[4], [u, v], [u + 2, v]);
    line(p.hat[1], [17, -37], [19, -33]); line(p.hat[3], [-10, -46], [-6, -44]);
  } else {
    line(p.hat[3], [-25, -42], [-21, -44]); line(p.hat[1], [-5, -22], [13, -23]);
  }
}

function drawPortrait(d, identity, pose, frame, drawProps = true) {
  const p = PALETTES[identity], s = portraitState(identity, pose, frame);
  const farShoulder = [57 + s.lean, 135 + s.shoulder];
  const nearShoulder = [130 + s.lean, 135 + s.shoulder];
  portraitArm(d, p, farShoulder, s.leftElbow, s.leftHand, identity, true);
  portraitCoat(d, p, s, identity);
  portraitHead(d, p, s, identity);
  portraitArm(d, p, nearShoulder, s.rightElbow, s.rightHand, identity, false);
  if (s.paper && drawProps) paperMap(d, s.leftHand, s.rightHand, s.fold, true);
  portraitHand(d, p, s.leftHand, s.leftGesture, true);
  portraitHand(d, p, s.rightHand, s.rightGesture);
}

// ---------------- Horse anatomy and separately posed rider ----------------
// Each leg has its own contact track. Values are [hoof dx, hoof lift, knee dx,
// knee lift]. Walk is a four-beat gait; gallop has gather AND suspension frames.
const WALK_LEG = [
  [10, 0, 4, 0], [6, 0, 2, 0], [1, 0, 0, 0], [-5, 0, -2, 0],
  [-10, 1, -4, 1], [-7, 9, 1, 4], [0, 13, 6, 7], [7, 7, 7, 4],
];
const GALLOP_HIND = [
  [-13, 0, -3, 0], [-8, 0, 2, 1], [3, 7, 8, 6], [13, 16, 11, 12],
  [15, 20, 7, 15], [5, 13, -1, 9], [-6, 8, -7, 5], [-14, 3, -7, 1],
];
const GALLOP_FRONT = [
  [-11, 12, -3, 8], [-15, 19, -7, 13], [-6, 22, -5, 14], [9, 15, 5, 10],
  [17, 5, 8, 3], [13, 0, 6, 0], [3, 0, 1, 0], [-7, 4, -3, 2],
];
const HORSE = {
  coat: ['#49342e', '#704b36', '#996747', '#bb8a5a'],
  far: ['#342d2b', '#503c31', '#76523d', '#997450'],
  mane: ['#25252a', '#383032', '#514039', '#735744'],
  sock: ['#777366', '#a29b85', '#c5b99a', '#ddcfac'],
  saddle: ['#30282a', '#50392e', '#7a5239', '#ab7c4d'],
};

function horseMotion(pose, frame) {
  return {
    bob: pose === 'gallop' ? [0, -2, -5, -6, -4, -1, 2, 1][frame]
      : pose === 'walk' ? [0, 1, 0, -1, 0, 1, 0, -1][frame] : 0,
    pitch: pose === 'gallop' ? [1, 0, -2, -3, -1, 1, 2, 2][frame]
      : pose === 'walk' ? [0, 1, 1, 0, -1, -1, 0, 0][frame] : [0, 0, 0, 1, 1, 0, 0, 0][frame],
    tail: pose === 'gallop' ? [-2, -4, -5, -3, 0, 2, 1, -1][frame]
      : pose === 'walk' ? [0, -1, -2, -1, 0, 1, 2, 1][frame] : [0, 0, 1, 3, 2, 0, -1, 0][frame],
  };
}

function horseLeg(d, pose, frame, front, far, motion) {
  const hipX = front ? 105 : 50, hipY = (front ? 89 : 91) + motion.bob;
  let key = [0, 0, 0, 0];
  if (pose === 'walk') {
    const phase = front ? (far ? 6 : 2) : (far ? 4 : 0);
    key = WALK_LEG[(frame + phase) % 8];
  } else if (pose === 'gallop') {
    key = (front ? GALLOP_FRONT : GALLOP_HIND)[(frame + (far ? 1 : 0)) % 8];
  } else if (!front && far) {
    // Relaxed resting hind hoof, not four locked vertical poles.
    key = [-4, 2, 3, 1];
  }
  const depth = far ? -4 : 0, ramp = far ? HORSE.far : HORSE.coat;
  const hip = [hipX + depth, hipY];
  const knee = [hipX + depth + (front ? -1 : 8) + key[2], 107 + motion.bob * 0.3 - key[3]];
  const fetlock = [hipX + depth + key[0], 130 - key[1]];
  const hoof = [fetlock[0] + (front ? 2 : -1), 136 - key[1]];
  segment(d, hip, knee, front ? 11 : 15, 7, ramp, far);
  segment(d, knee, fetlock, 6, 4, ramp, far);
  // Distinct hock/carpus and a short pastern, not a single bent stick.
  d.oval(ramp[1], knee[0], knee[1], 4, 3);
  d.line(ramp[3], at(knee, -2, -1), at(knee, 1, -2));
  segment(d, fetlock, hoof, 4, 5, front && !far ? HORSE.sock : ramp, far);
  if (!far && front) d.line(HORSE.sock[2], at(fetlock, 0, -5), hoof, 3);
  d.poly(INK, [[hoof[0] - 3, hoof[1] - 2], [hoof[0] + 3, hoof[1] - 2], [hoof[0] + 6, hoof[1] + 1], [hoof[0] + 5, hoof[1] + 3], [hoof[0] - 4, hoof[1] + 3]]);
  d.line('#736a5c', [hoof[0] - 2, hoof[1] - 1], [hoof[0] + 3, hoof[1]]);
}

function horseTail(d, motion, pose) {
  const b = motion.bob, t = motion.tail, flying = pose === 'gallop';
  const end = flying ? [11, 92 + t] : [23 + t, 121];
  d.poly(INK, [[42, 77 + b], [35, 78 + b], [29, 90 + t], [end[0] - 4, end[1] - 7], [end[0] - 5, end[1] + 3], [end[0] + 3, end[1]], [34, 96 + t], [40, 86 + b]]);
  d.path(HORSE.mane[1], [[39, 80 + b], [34, 88 + t], [30, 100 + (flying ? -9 : 0)], end], 5);
  d.path(HORSE.mane[2], [[37, 81 + b], [32, 90 + t], [end[0], end[1] - 4]], 2);
  d.line(HORSE.mane[3], [35, 85 + b], [32, 94 + t]);
  d.line(HORSE.mane[0], [end[0], end[1] - 7], [end[0] - 2, end[1] + 2]);
}

function horseBody(d, motion) {
  const b = motion.bob, p = HORSE.coat, v = vertices => vertices.map(([x, y]) => [x, y + b]);
  d.poly(INK, v([[36, 78], [43, 71], [57, 68], [81, 71], [97, 70], [110, 77], [114, 88], [108, 101], [98, 108], [72, 110], [50, 107], [37, 97], [33, 86]]));
  d.poly(p[2], v([[38, 79], [44, 73], [57, 70], [81, 73], [97, 72], [108, 79], [112, 88], [106, 99], [97, 106], [73, 108], [51, 105], [39, 95], [35, 86]]));
  d.poly(p[3], v([[40, 80], [47, 75], [57, 73], [72, 75], [85, 75], [99, 76], [105, 82], [87, 81], [66, 80], [48, 84]]));
  d.poly(p[1], v([[38, 88], [49, 95], [73, 99], [99, 96], [108, 90], [104, 101], [96, 106], [73, 108], [52, 104], [40, 95]]));
  d.poly(p[0], v([[48, 100], [68, 104], [88, 104], [103, 100], [96, 107], [72, 109], [54, 106]]));
  // Shoulder blade, barrel contour and haunch planes.
  d.path(p[1], v([[104, 80], [98, 83], [96, 90], [100, 97]]), 2);
  d.path(p[3], v([[101, 83], [99, 88], [101, 94]]));
  d.path(p[1], v([[47, 78], [53, 83], [55, 91], [51, 97]]), 2);
  d.line(p[3], [41, 85 + b], [44, 92 + b]);
  d.texture(p[2], p[1], 37, 75 + b, 73, 29, 0x484f5253, 67);
}

function horseNeck(d, motion, pose, frame) {
  const b = motion.bob, pitch = motion.pitch, p = HORSE.coat;
  const pt = (x, y) => [x + (y < 65 ? pitch : 0), y + b + (y < 65 ? pitch : 0)];
  const poly = (color, points) => d.poly(color, points.map(([x, y]) => pt(x, y)));
  const path = (color, points, w = 1) => d.path(color, points.map(([x, y]) => pt(x, y)), w);
  poly(INK, [[93, 78], [98, 61], [110, 45], [120, 41], [129, 46], [131, 55], [136, 61], [148, 65], [151, 72], [146, 78], [137, 76], [125, 67], [120, 82], [111, 94], [102, 96]]);
  poly(p[2], [[95, 78], [101, 62], [112, 47], [120, 43], [127, 48], [129, 56], [135, 63], [146, 67], [149, 72], [145, 76], [138, 74], [124, 64], [117, 82], [110, 91], [103, 93]]);
  poly(p[3], [[101, 72], [108, 57], [116, 48], [122, 47], [122, 55], [115, 66], [111, 81], [106, 87], [103, 84]]);
  poly(p[1], [[112, 72], [120, 59], [125, 64], [119, 82], [111, 92], [105, 93]]);
  poly(p[1], [[124, 50], [127, 56], [135, 63], [145, 68], [146, 73], [139, 72], [129, 64], [123, 58]]);
  // Tall movable ears, fetlock-white blaze, eyelid and muzzle plane.
  const ear = pose === 'idle' ? [0, 0, 0, -1, -2, -1, 0, 0][frame] : 0;
  poly(INK, [[113, 48], [111 + ear, 35], [116 + ear, 38], [119, 45], [122, 35], [126, 33], [126, 45], [128, 49]]);
  path(p[2], [[114 + ear, 38], [116, 44]], 2);
  path(p[3], [[124, 37], [124, 44]], 2);
  poly(HORSE.sock[2], [[123, 48], [126, 49], [127, 57], [135, 65], [133, 67], [124, 59], [121, 54]]);
  path(HORSE.sock[3], [[124, 50], [125, 56], [131, 63]]);
  poly('#775d50', [[140, 67], [147, 68], [149, 72], [145, 76], [139, 73]]);
  d.line(INK, pt(144, 70), pt(146, 71), 2);
  path(INK, [[141, 75], [146, 74]]);
  d.line(HORSE.mane[0], pt(126, 55), pt(130, 57), 2);
  if (!(pose === 'idle' && frame === 5)) { d.dot('#d6bd83', ...pt(128, 56)); d.dot(INK, ...pt(129, 56)); }
  path(p[0], [[127, 60], [130, 61]]);
  // Flowing mane uses discrete locks following neck anatomy, not fuzzy noise.
  const wind = pose === 'gallop' ? -3 : 0;
  for (let i = 0; i < 8; i++) {
    const mx = 114 - i * 2, my = 45 + i * 4 + b;
    const flick = [0, 1, 1, 0, -1, -1, 0, 0][(frame + i) % 8];
    d.poly(HORSE.mane[0], [[mx, my], [mx + 3, my + 1], [mx - 1, my + 8], [mx - 6 + wind, my + 10 + flick], [mx - 3, my + 3]]);
    d.line(HORSE.mane[2], [mx, my + 2], [mx - 3 + wind, my + 8 + flick]);
  }
  // Leather cheekpiece, noseband, throat latch and small brass hardware.
  path(HORSE.saddle[0], [[119, 46], [127, 52], [134, 64], [140, 70]], 3);
  path(HORSE.saddle[2], [[119, 46], [127, 52], [134, 64], [140, 70]]);
  path(HORSE.saddle[0], [[138, 65], [136, 70], [139, 75]], 3);
  path(HORSE.saddle[3], [[138, 65], [137, 70], [139, 74]]);
  path(HORSE.saddle[1], [[128, 53], [121, 65], [124, 69]]);
  d.rect('#c1a471', ...pt(138, 71), 3, 3); d.dot(HORSE.saddle[0], ...pt(139, 72));
  return pt(138, 72);
}

function horseSaddle(d, motion) {
  const b = motion.bob, p = HORSE.saddle;
  // Blanket is under the saddle, stitched border distinct from leather cinch.
  d.poly(INK, [[58, 70 + b], [87, 71 + b], [97, 76 + b], [94, 94 + b], [61, 93 + b], [55, 87 + b]]);
  d.poly('#755548', [[59, 72 + b], [87, 73 + b], [95, 77 + b], [92, 92 + b], [62, 91 + b], [57, 86 + b]]);
  d.path('#bca077', [[59, 83 + b], [62, 89 + b], [91, 90 + b], [93, 79 + b]], 2);
  d.line('#393f49', [63, 86 + b], [90, 87 + b], 2);
  for (let x = 64; x < 90; x += 5) d.rect('#d0b68d', x, 90 + b, 2, 1);
  d.line(p[0], [84, 77 + b], [85, 105 + b], 6);
  d.line(p[2], [84, 78 + b], [85, 104 + b], 3);
  d.rect('#af9369', 83, 99 + b, 5, 4); d.rect(p[0], 84, 100 + b, 3, 2);
  d.poly(p[0], [[57, 66 + b], [62, 65 + b], [67, 71 + b], [80, 71 + b], [86, 65 + b], [92, 67 + b], [92, 78 + b], [84, 83 + b], [65, 81 + b], [57, 74 + b]]);
  d.poly(p[2], [[59, 68 + b], [62, 67 + b], [67, 73 + b], [81, 73 + b], [87, 67 + b], [90, 69 + b], [90, 76 + b], [83, 80 + b], [65, 79 + b], [59, 73 + b]]);
  d.path(p[3], [[61, 68 + b], [67, 74 + b], [81, 74 + b], [87, 68 + b]]);
  d.rect(p[0], 86, 61 + b, 4, 8); d.rect(p[3], 84, 60 + b, 7, 3);
  // Compact saddle roll and pannier: readable travelling kit, not armament.
  d.rect(INK, 49, 66 + b, 12, 9); d.rect('#6b7973', 50, 67 + b, 10, 7);
  d.rect('#aab19a', 51, 67 + b, 7, 2); d.rect(p[1], 53, 67 + b, 2, 7);
  d.poly(p[0], [[51, 79 + b], [62, 79 + b], [66, 96 + b], [52, 98 + b], [48, 87 + b]]);
  d.poly(p[2], [[52, 81 + b], [60, 81 + b], [64, 94 + b], [53, 96 + b], [50, 87 + b]]);
  d.path(p[3], [[52, 82 + b], [60, 82 + b], [60, 87 + b], [54, 89 + b]]);
  d.rect('#bfa273', 56, 87 + b, 2, 3);
}

function drawRider(d, motion, pose, frame) {
  const p = PALETTES.arthur, b = motion.bob;
  const lean = pose === 'gallop' ? [4, 6, 8, 9, 8, 6, 4, 3][frame] : pose === 'walk' ? [0, 1, 1, 0, -1, -1, 0, 0][frame] : 0;
  const sx = 70 + lean, sy = 43 + b, hip = [69, 70 + b];
  // Far leg and far forearm remain behind the weight-bearing near side.
  segment(d, [67, 70 + b], [80, 80 + b], 8, 6, p.pants, true);
  segment(d, [80, 80 + b], [83, 94 + b], 6, 4, p.pants, true);
  segment(d, [sx - 4, sy + 2], [85, 55 + b], 7, 5, p.shirt, true);
  segment(d, [85, 55 + b], [97, 54 + b], 5, 4, p.skin, true);
  d.poly(INK, [[sx - 6, sy - 6], [sx + 6, sy - 6], [sx + 10, sy + 3], [76, 70 + b], [63, 73 + b], [sx - 9, sy + 12], [sx - 10, sy + 1]]);
  d.poly(p.shirt[2], [[sx - 5, sy - 4], [sx + 5, sy - 4], [sx + 8, sy + 3], [74, 68 + b], [64, 70 + b], [sx - 7, sy + 11], [sx - 8, sy + 2]]);
  d.poly(p.shirt[1], [[sx - 7, sy + 2], [sx - 2, sy + 6], [68, 68 + b], [64, 70 + b], [sx - 7, sy + 11]]);
  d.line(p.shirt[3], [sx - 4, sy - 3], [sx + 5, sy - 2]);
  d.line(p.leather[0], [sx + 5, sy - 4], [64, 68 + b], 4);
  d.line(p.leather[2], [sx + 5, sy - 4], [64, 68 + b], 2);
  d.line(p.leather[3], [sx + 4, sy - 4], [63, 68 + b]);
  d.line(p.leather[1], [63, 69 + b], [75, 69 + b], 3);
  // Bent near thigh, knee, calf, heel lowered into a visible metal stirrup.
  segment(d, hip, [82, 83 + b], 10, 7, p.pants);
  segment(d, [82, 83 + b], [79, 99 + b], 7, 5, p.pants);
  d.path(p.pants[0], [[78, 82 + b], [83, 84 + b], [83, 88 + b]]);
  d.poly(INK, [[76, 95 + b], [82, 95 + b], [83, 101 + b], [89, 103 + b], [89, 106 + b], [76, 106 + b]]);
  d.poly(p.boot[2], [[77, 96 + b], [81, 96 + b], [82, 102 + b], [87, 104 + b], [77, 104 + b]]);
  d.path('#b6a78a', [[76, 95 + b], [73, 102 + b], [75, 107 + b], [87, 107 + b], [89, 103 + b]]);
  d.line(p.leather[1], [76, 76 + b], [75, 98 + b], 2);
  // Rider head is its own 15px anatomy, not a scaled walking sprite.
  const hx = sx + 1, hy = sy - 16;
  d.rect(p.skin[1], hx - 2, hy + 8, 6, 7);
  d.poly(INK, [[hx - 7, hy - 5], [hx + 4, hy - 5], [hx + 7, hy], [hx + 9, hy + 3], [hx + 6, hy + 8], [hx + 2, hy + 12], [hx - 5, hy + 8], [hx - 7, hy + 2]]);
  d.poly(p.skin[2], [[hx - 5, hy - 4], [hx + 3, hy - 4], [hx + 5, hy], [hx + 7, hy + 3], [hx + 4, hy + 8], [hx + 1, hy + 10], [hx - 4, hy + 7]]);
  d.line(p.skin[3], [hx + 3, hy + 2], [hx + 5, hy + 4]);
  d.rect(p.hair[1], hx - 6, hy - 4, 3, 9);
  d.path(p.hair[2], [[hx - 3, hy + 6], [hx, hy + 9], [hx + 4, hy + 8]], 2);
  d.dot(INK, hx + 4, hy + 1); d.line(p.hair[0], [hx + 2, hy - 1], [hx + 5, hy - 1]);
  d.line(p.skin[0], [hx + 2, hy + 6], [hx + 5, hy + 6]);
  d.poly(INK, [[hx - 14, hy - 6], [hx - 8, hy - 9], [hx - 6, hy - 16], [hx - 1, hy - 17], [hx + 3, hy - 15], [hx + 7, hy - 15], [hx + 9, hy - 8], [hx + 15, hy - 5], [hx + 9, hy - 2], [hx - 8, hy - 3]]);
  d.poly(p.hat[2], [[hx - 7, hy - 8], [hx - 5, hy - 14], [hx - 1, hy - 15], [hx + 3, hy - 13], [hx + 6, hy - 13], [hx + 7, hy - 8]]);
  d.line(p.hat[0], [hx - 7, hy - 8], [hx + 8, hy - 8], 2);
  d.line(p.leather[2], [hx - 6, hy - 8], [hx + 7, hy - 8]);
  d.poly(p.hat[2], [[hx - 12, hy - 6], [hx - 7, hy - 7], [hx + 7, hy - 7], [hx + 13, hy - 5], [hx + 8, hy - 4], [hx - 7, hy - 4]]);
  d.dot(p.hat[4], hx - 10, hy - 6); d.line(p.hat[0], [hx - 3, hy - 3], [hx + 8, hy - 3]);
  segment(d, [sx + 7, sy + 2], [90, 58 + b], 8, 6, p.shirt);
  segment(d, [90, 58 + b], [100, 56 + b], 5, 4, p.skin);
  d.line(p.shirt[3], [87, 55 + b], [90, 61 + b], 2);
  smallHand(d, p, [97, 54 + b], 'grip', true);
  smallHand(d, p, [100, 56 + b], 'grip');
  return [100, 57 + b];
}

function drawHorse(d, rider, pose, frame) {
  const m = horseMotion(pose, frame);
  horseTail(d, m, pose);
  horseLeg(d, pose, frame, false, true, m);
  horseLeg(d, pose, frame, true, true, m);
  horseBody(d, m);
  horseLeg(d, pose, frame, false, false, m);
  horseLeg(d, pose, frame, true, false, m);
  const bit = horseNeck(d, m, pose, frame);
  horseSaddle(d, m);
  const grip = rider === 'arthur' ? drawRider(d, m, pose, frame) : [89, 67 + m.bob];
  // Loose paired reins, never an artificial horizontal line through the head.
  d.path(HORSE.saddle[0], [bit, [121, 80 + m.bob], [110, 76 + m.bob], grip]);
  d.path(HORSE.saddle[2], [at(bit, 0, 2), [122, 84 + m.bob], [109, 81 + m.bob], at(grip, -2, 1)]);
}

// ---------------- Lazy Canvas2D atlas construction ----------------
function canvasOf(width, height) {
  // Prefer a regular unmounted canvas for caller compatibility; OffscreenCanvas
  // is a worker fallback. Neither constructor is touched before the API call.
  let canvas;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    throw new Error('createActorAtlases() needs Canvas2D (document or OffscreenCanvas); module import is safe without it.');
  }
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D is unavailable for actor atlas construction.');
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function makeAtlas(frameWidth, frameHeight, poses, draw) {
  const { canvas, context } = canvasOf(frameWidth * COLUMNS, frameHeight * poses.length);
  const image = context.createImageData(frameWidth, frameHeight);
  for (let row = 0; row < poses.length; row++) {
    for (let frame = 0; frame < COLUMNS; frame++) {
      const pixels = new Pixels(frameWidth, frameHeight);
      try { draw(pixels, poses[row], frame); }
      catch (error) { throw new Error(`Actor atlas ${frameWidth}x${frameHeight}, ${poses[row]} frame ${frame}: ${error.message}`, { cause: error }); }
      image.data.set(pixels.data);
      context.putImageData(image, frame * frameWidth, row * frameHeight);
    }
  }
  return { canvas, columns: COLUMNS, rows: poses.length, frameWidth, frameHeight, poses: poses.slice(), feet: 0.04 };
}

/**
 * @returns {{people: {arthur: object, dutch: object, camp: object},
 * horses: {arthur: object, none: object}, portraits: {arthur: object, dutch: object}}}
 * Every Atlas: {canvas, columns:8, rows, frameWidth, frameHeight, poses, feet:0.04}.
 * All seven canvases build once on the first successful call; subsequent calls
 * return exactly the same object and canvas references. A failed build is not
 * published, so callers never receive a half-initialized cache.
 */
export function createActorAtlases({props = true} = {}) {
  if (cachedAtlases.has(props)) return cachedAtlases.get(props);
  const people = {}, horses = {}, portraits = {};
  for (const identity of ['arthur', 'dutch', 'camp']) {
    people[identity] = makeAtlas(96, 128, PERSON_POSES, (d, pose, frame) => drawPerson(d, identity, pose, frame, props));
  }
  for (const rider of ['arthur', 'none']) {
    horses[rider] = makeAtlas(160, 144, HORSE_POSES, (d, pose, frame) => drawHorse(d, rider, pose, frame));
  }
  for (const identity of ['arthur', 'dutch']) {
    portraits[identity] = makeAtlas(192, 224, PERSON_POSES, (d, pose, frame) => drawPortrait(d, identity, pose, frame, props));
  }
  const atlases = { people, horses, portraits };
  cachedAtlases.set(props, atlases);
  return atlases;
}

// Pixel-space contact metadata shares the exact authored pose used by the atlas.
// The world can render a single physical prop without a second map painted on it.
export function actorContacts(identity, pose, frame, portrait = false) {
  const id = PALETTES[identity] ? identity : 'camp';
  const s = portrait ? portraitState(id, pose, frame) : personState(id, pose, frame);
  return portrait ? {far:s.leftHand,near:s.rightHand} : {far:s.farHand,near:s.nearHand};
}