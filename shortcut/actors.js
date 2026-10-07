/*
 * 赶路的人 — original warm, lively 2D pixel actors; no assets or dependencies.
 * Load as a classic script, then: const actors = createShortcutActors();
 *
 * person(ctx, x, groundY, time, options = {})
 *   identity: 'hero' (阿禾, default) | 'dispatcher' | 'student'
 *   action: 'idle' (default) | 'walk' | 'run' | 'point' | 'unfold' |
 *           'think' | 'signal' | 'study' | 'ride'
 *   expression: 'hope' (default) | 'worry' | 'thought' | 'resolve'
 *   phase: 0..1, default 1. One-shot pose/opening progress, NOT elapsed time.
 *          End poses hold indefinitely. Walk/run ignore it; ride uses it as
 *          a pedal-cycle offset. Supply increasing phase to open a map/book.
 *   scale: positive finite number, default 1; facing: negative = left,
 *          otherwise right, default 1. x is the standing pelvis reference;
 *          groundY is the sole-contact line (pixels do not extend below it).
 *   palette: optional object of opaque #RGB / #RRGGBB overrides; unknown keys,
 *            inherited properties and invalid values are ignored. Keys:
 *     ink, skin, skinShade, skinLight, hair, hairLight,
 *     jacket, jacketShade, jacketLight, scarf, scarfLight,
 *     bag, bagShade, strap, pants, pantsShade, shoes, sole,
 *     paper, paperShade, mapInk, book, frame, frameShade, teal,
 *     metal, rim, tire, parcel, parcelShade, tape.
 *   Standing silhouette about 24 x 40 local pixels; running/gestures/maps
 *   need roughly 42 x 43. Head is only 10 pixels tall, not a chibi head.
 *   'ride' alone is a seated pedalling figure, grounded by its lower shoe;
 *   use bicycle(..., {rider:true}) for an integrated, correctly fitted rider.
 *
 * bicycle(ctx, x, groundY, time, options = {})
 *   scale/facing/palette/expression: as above; rider: true; moving: true;
 *   effort: 0..1, default .35 (cadence and forward lean).
 *   phase: 0..1, default 0, pedal-cycle OFFSET; moving:false freezes this
 *          angle, including wheels, scarf and bag. A whole turn is phase 1.
 *   x is midway between the axles; wheel soles touch groundY. Approximately
 *   76 x 48 pixels WITH the single integrated 阿禾 rider and parcel stack.
 *   Both hands meet fixed handlebar grips; shoe soles meet rotating pedals.
 *
 * time is finite seconds (invalid -> 0), used ONLY for gait/pedal/wheel loops
 * and their mechanically coupled arms, scarf and satchel. No random state,
 * blinking timers, wall clock, shadows, canvas clearing/resizing or exports.
 * All drawing uses integer pixel cells, including polygon edges and wheels.
 * Both public functions return undefined and always save/restore context.
 */
function createShortcutActors() {
  'use strict';

  const TAU = Math.PI * 2;
  const ACTIONS = ['idle', 'walk', 'run', 'point', 'unfold', 'think', 'signal', 'study', 'ride'];
  const EXPRESSIONS = ['hope', 'worry', 'thought', 'resolve'];
  const BASE = {
    ink: '#29343d', skin: '#e3ac81', skinShade: '#bc795c', skinLight: '#f7c89b',
    hair: '#30303a', hairLight: '#53515a',
    jacket: '#32988e', jacketShade: '#216764', jacketLight: '#74c1aa',
    scarf: '#d5a344', scarfLight: '#f2cd73',
    bag: '#e88a45', bagShade: '#b45c34', strap: '#995e3c',
    pants: '#42464f', pantsShade: '#303640', shoes: '#f4e4bf', sole: '#bbaa8b',
    paper: '#fff0c9', paperShade: '#dfcfaa', mapInk: '#578c91', book: '#b95854',
    frame: '#edbe4d', frameShade: '#bf873b', teal: '#398e8a',
    metal: '#91a8a5', rim: '#d4dcc8', tire: '#36414a',
    parcel: '#dfb57b', parcelShade: '#b18152', tape: '#fff0b8'
  };
  const IDENTITIES = {
    hero: {},
    dispatcher: {
      skin: '#c78e69', skinShade: '#996145', skinLight: '#e5b183',
      hair: '#65606a', hairLight: '#a09a99',
      jacket: '#7d789c', jacketShade: '#545875', jacketLight: '#b1a5c4',
      bag: '#718e80', bagShade: '#4d6a65', strap: '#535e67'
    },
    student: {
      skin: '#ecc09a', skinShade: '#c18d70', skinLight: '#ffdab1',
      hair: '#684940', hairLight: '#9b6b4b',
      jacket: '#cb725a', jacketShade: '#98514c', jacketLight: '#eba47d',
      scarf: '#88ad93', scarfLight: '#c0d8aa',
      bag: '#638d9b', bagShade: '#3d667b', strap: '#465a6b',
      pants: '#4e5871', pantsShade: '#353e59', book: '#53778f'
    }
  };
  const owns = (object, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(object, key);
  const objectOf = value => value && typeof value === 'object' ? value : {};
  const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const unit = (value, fallback) => clamp(finite(value, fallback), 0, 1);
  const choose = (value, values, fallback) => values.includes(value) ? value : fallback;
  const lerp = (a, b, u) => a + (b - a) * u;
  const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  const point = (x, y) => [Math.round(x), Math.round(y)];
  const add = (a, x, y) => point(a[0] + x, a[1] + y);
  function ease(value, start = 0, end = 1) {
    const u = clamp((value - start) / (end - start), 0, 1);
    return u * u * (3 - 2 * u);
  }
  function cycle(time, period, offset = 0) {
    const seconds = finite(time, 0);
    return (((seconds % period) / period + offset) % 1 + 1) % 1;
  }
  function colors(identity, overrides) {
    const result = { ...BASE, ...IDENTITIES[identity] };
    const values = objectOf(overrides);
    for (const key of Object.keys(result)) {
      if (owns(values, key) && typeof values[key] === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(values[key])) {
        result[key] = values[key];
      }
    }
    return result;
  }
  function rect(ctx, color, x, y, width, height) {
    const w = Math.round(width), h = Math.round(height);
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  // Bresenham square cells, not antialiased canvas strokes.
  function line(ctx, color, a, b, width = 1) {
    let x = Math.round(a[0]), y = Math.round(a[1]);
    const x2 = Math.round(b[0]), y2 = Math.round(b[1]);
    const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y);
    const sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
    const half = Math.floor(width / 2);
    let error = dx + dy;
    for (;;) {
      rect(ctx, color, x - half, y - half, width, width);
      if (x === x2 && y === y2) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }
  // Scan-convert at pixel centres: even sloped cloth/page edges stay stepped.
  function polygon(ctx, color, vertices) {
    const v = vertices.map(([x, y]) => point(x, y));
    const top = Math.min(...v.map(p => p[1])), bottom = Math.max(...v.map(p => p[1]));
    for (let y = top; y < bottom; y++) {
      const scan = y + 0.5, crossings = [];
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length];
        if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) {
          crossings.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const left = Math.ceil(crossings[i] - 0.5), right = Math.ceil(crossings[i + 1] - 0.5);
        rect(ctx, color, left, y, right - left, 1);
      }
    }
  }
  function clipped(ctx, x, y, width, height, draw) {
    ctx.save();
    try {
      ctx.beginPath();
      ctx.rect(Math.round(x), Math.round(y), Math.max(0, Math.round(width)), Math.max(0, Math.round(height)));
      ctx.clip();
      draw();
    } finally { ctx.restore(); }
  }
  function placed(ctx, x, groundY, options, draw) {
    ctx.save();
    try {
      const proposed = finite(options.scale, 1), scale = proposed > 0 ? proposed : 1;
      ctx.translate(Math.round(finite(x, 0)), Math.round(finite(groundY, 0)));
      ctx.scale(finite(options.facing, 1) < 0 ? -scale : scale, scale);
      ctx.imageSmoothingEnabled = false;
      draw();
    } finally { ctx.restore(); }
  }
  function limb(ctx, p, root, elbow, end, fill, width = 3, highlight) {
    line(ctx, p.ink, root, elbow, width + 2);
    line(ctx, p.ink, elbow, end, width + 2);
    line(ctx, fill, root, elbow, width);
    line(ctx, fill, elbow, end, width);
    if (highlight) line(ctx, highlight, add(root, -1, 0), add(mix(root, elbow, 0.65), -1, 0));
  }
  // Two-link inverse kinematics. The chosen bend keeps knees forward. Endpoints
  // are never moved by the solver: shoes must stay on ground/pedals.
  function joint(root, end, upper, lower, bend = -1) {
    const dx = end[0] - root[0], dy = end[1] - root[1];
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const along = clamp((upper * upper - lower * lower + distance * distance) / (2 * distance), -upper, upper);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along)) * bend;
    return point(root[0] + (dx * along - dy * height) / distance, root[1] + (dy * along + dx * height) / distance);
  }
  // foot.y is the EXCLUSIVE sole bottom. On a bicycle the pedal begins there.
  function shoe(ctx, p, foot, far = false) {
    const [x, y] = foot;
    polygon(ctx, p.ink, [[x - 3, y - 4], [x + 1, y - 4], [x + 2, y - 3], [x + 5, y - 2], [x + 5, y], [x - 3, y]]);
    rect(ctx, far ? p.sole : p.shoes, x - 2, y - 3, 4, 2);
    rect(ctx, far ? p.sole : p.shoes, x + 1, y - 2, 3, 1);
    rect(ctx, p.sole, x - 2, y - 1, 6, 1);
    rect(ctx, p.ink, x, y - 3, 1, 1);
  }
  function leg(ctx, p, hip, foot, far, upper = 9, lower = 9, posedKnee = null) {
    const ankle = add(foot, -1, -4), knee = posedKnee || joint(hip, ankle, upper, lower);
    limb(ctx, p, hip, knee, ankle, far ? p.pantsShade : p.pants, 3);
    if (!far) {
      rect(ctx, p.pantsShade, knee[0] - 1, knee[1], 3, 1);
      line(ctx, p.sole, add(ankle, -1, 0), add(ankle, 1, 0));
    }
    shoe(ctx, p, foot, far);
  }
  function arm(ctx, p, pose, far = false) {
    limb(ctx, p, pose.root, pose.elbow, pose.hand, far ? p.jacketShade : p.jacket, 3, far ? null : p.jacketLight);
    const cuff = mix(pose.elbow, pose.hand, 0.82);
    rect(ctx, p.jacketShade, cuff[0] - 1, cuff[1] - 1, 3, 2);
  }
  function hand(ctx, p, position, kind = 'relaxed') {
    const [x, y] = point(...position);
    rect(ctx, p.ink, x - 2, y - 2, 4, 4);
    rect(ctx, p.skin, x - 1, y - 1, 3, 3);
    rect(ctx, p.skinLight, x, y - 1, 1, 1);
    if (kind === 'point') {
      line(ctx, p.ink, [x + 1, y - 1], [x + 6, y - 1], 3);
      line(ctx, p.skin, [x, y - 1], [x + 6, y - 1]);
      rect(ctx, p.skinShade, x + 1, y + 1, 2, 1);
    } else if (kind === 'signal') {
      rect(ctx, p.ink, x - 1, y - 6, 3, 6);
      rect(ctx, p.skin, x, y - 5, 1, 5);
      rect(ctx, p.skinLight, x + 2, y - 4, 1, 4);
      rect(ctx, p.skin, x + 3, y - 2, 1, 3);
      rect(ctx, p.skinShade, x - 1, y + 1, 3, 1);
    } else if (kind === 'grip') {
      rect(ctx, p.skinShade, x - 1, y + 1, 3, 1);
      rect(ctx, p.skinLight, x + 1, y, 1, 1);
    }
  }
  function scarfTail(ctx, p, shoulders, motion, wind) {
    const [x, y] = shoulders;
    const endX = x - 8 - Math.round(wind * 5), endY = y + 4 - Math.round(wind * 5) + Math.round(motion);
    polygon(ctx, p.ink, [[x, y - 2], [x - 3, y - 2], [endX, endY - 2], [endX - 3, endY - 1], [endX - 1, endY + 2], [x - 4, y + 2]]);
    polygon(ctx, p.scarf, [[x, y - 1], [x - 3, y - 1], [endX - 1, endY], [endX, endY + 1], [x - 4, y + 1]]);
    line(ctx, p.scarfLight, [x - 3, y - 1], [endX, endY]);
    rect(ctx, p.scarf, endX - 2, endY + 1, 1, 2);
  }
  function torso(ctx, p, identity, hip, shoulders, bagSwing) {
    const [x, y] = shoulders, [hx, hy] = hip;
    polygon(ctx, p.ink, [[x - 4, y - 2], [x + 4, y - 2], [x + 6, y + 1], [hx + 5, hy - 1], [hx + 4, hy + 2], [hx - 5, hy + 2], [hx - 6, hy - 1], [x - 6, y + 1]]);
    polygon(ctx, p.jacket, [[x - 4, y - 1], [x + 3, y - 1], [x + 4, y + 2], [hx + 4, hy], [hx - 4, hy], [x - 4, y + 2]]);
    polygon(ctx, p.jacketShade, [[x + 2, y], [x + 4, y + 2], [hx + 4, hy], [hx, hy], [x, y + 4]]);
    line(ctx, p.jacketLight, [x - 3, y + 1], [hx - 3, hy - 3]);
    line(ctx, p.ink, [x + 1, y + 2], [hx + 1, hy]);
    rect(ctx, p.scarfLight, x + 1, y + 3, 1, 2);
    rect(ctx, p.jacketLight, hx + 2, hy - 4, 2, 1);
    rect(ctx, p.jacketShade, hx - 4, hy, 8, 1);
    if (identity === 'dispatcher') {
      line(ctx, p.scarfLight, [x - 1, y + 1], [hx + 2, hy - 5]);
      rect(ctx, p.ink, hx + 1, hy - 7, 4, 5);
      rect(ctx, p.paper, hx + 2, hy - 6, 2, 3);
      rect(ctx, p.teal, hx + 2, hy - 6, 2, 1);
    } else if (identity === 'student') {
      rect(ctx, p.paper, x + 2, y + 4, 2, 2);
      rect(ctx, p.book, x + 3, y + 4, 1, 2);
    }
    const bx = hx - 11 + Math.round(bagSwing), by = hy - 4 + Math.round(Math.abs(bagSwing) / 2);
    line(ctx, p.ink, [x + 3, y - 1], [bx + 5, by + 2], 3);
    line(ctx, p.strap, [x + 3, y - 1], [bx + 5, by + 2], 2);
    polygon(ctx, p.ink, [[bx + 1, by], [bx + 7, by], [bx + 9, by + 2], [bx + 9, by + 8], [bx + 7, by + 9], [bx, by + 9], [bx, by + 2]]);
    rect(ctx, p.bag, bx + 1, by + 2, 7, 6);
    rect(ctx, p.bagShade, bx + 7, by + 2, 1, 6);
    rect(ctx, p.bagShade, bx + 1, by + 1, 7, 3);
    rect(ctx, p.bag, bx + 2, by + 1, 5, 1);
    rect(ctx, p.scarfLight, bx + 4, by + 3, 2, 2);
    rect(ctx, p.ink, bx + 4, by + 4, 1, 1);
    rect(ctx, p.paperShade, bx + 2, by + 7, 4, 1);
    rect(ctx, p.bagShade, bx + 2, by + 5, 1, 2);
  }
  function head(ctx, p, identity, expression, origin) {
    const [x, y] = origin;
    rect(ctx, p.ink, x - 2, y + 8, 5, 5);
    rect(ctx, p.skinShade, x - 1, y + 9, 3, 3);
    polygon(ctx, p.ink, [[x - 3, y], [x + 3, y], [x + 3, y + 1], [x + 5, y + 1], [x + 5, y + 5], [x + 7, y + 6], [x + 7, y + 8], [x + 5, y + 8], [x + 4, y + 10], [x - 2, y + 10], [x - 4, y + 8], [x - 4, y + 2]]);
    rect(ctx, p.skin, x - 2, y + 2, 6, 7);
    rect(ctx, p.skin, x + 4, y + 4, 1, 4);
    rect(ctx, p.skin, x + 5, y + 6, 1, 1);
    rect(ctx, p.skinLight, x + 1, y + 3, 2, 1);
    rect(ctx, p.skinShade, x - 3, y + 6, 2, 2);
    rect(ctx, p.skinLight, x - 3, y + 6, 1, 1);
    // Close-cropped dark silhouette, tiny temple and crown highlights.
    rect(ctx, p.hair, x - 3, y + 1, 7, 2);
    rect(ctx, p.hair, x - 4, y + 2, 2, 4);
    rect(ctx, p.hair, x - 2, y + 3, 2, 1);
    rect(ctx, p.hairLight, x - 2, y + 1, 3, 1);
    if (identity === 'student') {
      rect(ctx, p.hair, x + 1, y + 2, 3, 2);
      rect(ctx, p.hairLight, x + 2, y + 2, 1, 1);
    } else if (identity === 'dispatcher') {
      rect(ctx, p.ink, x - 4, y - 1, 8, 3);
      rect(ctx, p.scarf, x - 3, y, 6, 2);
      rect(ctx, p.ink, x + 2, y + 2, 6, 2);
      rect(ctx, p.scarfLight, x + 2, y + 2, 5, 1);
      rect(ctx, p.teal, x, y, 2, 1);
    }
    // Two differently weighted eyes maintain a readable three-quarter face.
    const lookingDown = expression === 'thought';
    rect(ctx, p.paper, x + 3, y + 5, 2, 2);
    rect(ctx, p.ink, x, y + (lookingDown ? 6 : 5), 1, 1);
    rect(ctx, p.ink, x + 4, y + (lookingDown ? 6 : 5), 1, expression === 'worry' ? 2 : 1);
    if (expression === 'worry') {
      line(ctx, p.hair, [x - 1, y + 4], [x, y + 3]);
      line(ctx, p.hair, [x + 3, y + 3], [x + 4, y + 4]);
      rect(ctx, p.ink, x + 2, y + 8, 2, 2);
      rect(ctx, p.skinShade, x + 2, y + 9, 1, 1);
    } else if (expression === 'thought') {
      rect(ctx, p.hair, x - 1, y + 4, 2, 1);
      rect(ctx, p.hair, x + 3, y + 4, 2, 1);
      rect(ctx, p.skinShade, x + 1, y + 7, 1, 1);
      rect(ctx, p.ink, x + 2, y + 8, 2, 1);
    } else if (expression === 'resolve') {
      line(ctx, p.hair, [x - 1, y + 3], [x + 1, y + 4]);
      line(ctx, p.hair, [x + 3, y + 4], [x + 5, y + 3]);
      rect(ctx, p.ink, x + 2, y + 8, 3, 1);
    } else {
      rect(ctx, p.hair, x - 1, y + 3, 2, 1);
      rect(ctx, p.hair, x + 3, y + 3, 2, 1);
      rect(ctx, p.skinShade, x, y + 7, 2, 1);
      rect(ctx, p.ink, x + 2, y + 8, 2, 1);
      rect(ctx, p.ink, x + 4, y + 7, 1, 1);
    }
  }
  function collar(ctx, p, shoulders) {
    const [x, y] = shoulders;
    rect(ctx, p.ink, x - 3, y - 2, 7, 3);
    rect(ctx, p.scarf, x - 2, y - 2, 5, 2);
    rect(ctx, p.scarfLight, x - 1, y - 2, 3, 1);
    rect(ctx, p.scarf, x + 2, y, 2, 3);
    rect(ctx, p.scarfLight, x + 3, y, 1, 2);
  }
  function mapShape(progress) {
    const open = ease(progress, 0.22, 0.86);
    const width = 4 + Math.round(open * 22);
    const center = Math.round(lerp(8, 6, ease(progress, 0, 0.3)));
    const left = center - Math.floor(width / 2), top = Math.round(lerp(-19, -25, ease(progress, 0, 0.32)));
    return { left, top, width, height: 9 + Math.round(open * 5) };
  }
  function paperMap(ctx, p, map) {
    const { left: x, top: y, width: w, height: h } = map;
    polygon(ctx, p.ink, [[x + 1, y], [x + w - 1, y], [x + w, y + 1], [x + w, y + h - 1], [x + w - 1, y + h], [x, y + h], [x, y + 1]]);
    rect(ctx, p.paper, x + 1, y + 1, w - 2, h - 2);
    clipped(ctx, x + 1, y + 1, w - 2, h - 2, () => {
      if (w < 9) {
        rect(ctx, p.paperShade, x + 2, y + 1, 1, h - 2);
        line(ctx, p.mapInk, [x + 1, y + 3], [x + 2, y + h - 3]);
        return;
      }
      const fold = Math.floor(w / 3);
      rect(ctx, p.paperShade, x + fold, y + 1, 1, h - 2);
      rect(ctx, p.paperShade, x + fold * 2, y + 1, 1, h - 2);
      for (let row = 0; row < 3; row++) {
        line(ctx, p.paperShade, [x + 2, y + 3 + row * 3], [x + w - 3, y + 2 + row * 3]);
      }
      const route = [[x + 3, y + h - 4], [x + Math.round(w * 0.36), y + h - 4], [x + Math.round(w * 0.49), y + 5], [x + w - 6, y + 5], [x + w - 4, y + 3]];
      for (let i = 0; i + 1 < route.length; i++) line(ctx, p.mapInk, route[i], route[i + 1]);
      rect(ctx, p.teal, x + 2, y + h - 5, 3, 3);
      rect(ctx, p.book, x + w - 5, y + 2, 3, 3);
      rect(ctx, p.paper, x + w - 4, y + 3, 1, 1);
      rect(ctx, p.ink, x + 3, y + 2, 1, 2);
      rect(ctx, p.ink, x + 2, y + 3, 3, 1);
    });
  }
  function bookShape(progress) {
    const open = ease(progress, 0.2, 0.9), half = 2 + Math.round(open * 9);
    return { x: 7, y: Math.round(lerp(-19, -25, ease(progress, 0, 0.35))), half, open };
  }
  function openBook(ctx, p, book) {
    const { x, y, half: w, open } = book, rise = Math.round(open * 2);
    polygon(ctx, p.ink, [[x - w, y], [x, y + rise], [x + w, y], [x + w + 1, y + 10], [x, y + 13], [x - w - 1, y + 10]]);
    polygon(ctx, p.book, [[x - w, y + 1], [x, y + rise + 1], [x + w, y + 1], [x + w, y + 10], [x, y + 12], [x - w, y + 10]]);
    polygon(ctx, p.paperShade, [[x - w + 1, y + 1], [x, y + rise + 1], [x, y + 11], [x - w + 1, y + 9]]);
    polygon(ctx, p.paper, [[x + 1, y + rise + 1], [x + w - 1, y + 1], [x + w - 1, y + 9], [x + 1, y + 11]]);
    if (w > 5) {
      for (let row = 0; row < 3; row++) {
        line(ctx, p.mapInk, [x - w + 3, y + 3 + row * 2], [x - 3, y + 4 + row * 2]);
        line(ctx, p.paperShade, [x + 3, y + 4 + row * 2], [x + w - 3 - row % 2, y + 3 + row * 2]);
      }
      rect(ctx, p.book, x - w + 3, y + 3, 2, 2);
    }
    line(ctx, p.ink, [x, y + rise + 1], [x, y + 11]);
    rect(ctx, p.scarf, x + 2, y + 10, 1, 4);
  }
  // A stance foot remains at y=0; the other completes a distinct lifted return.
  function stepFoot(u, spread, lift, center) {
    const stance = u < 0.5, progress = stance ? u * 2 : (u - 0.5) * 2;
    return point(center + (stance ? lerp(spread, -spread, progress) : lerp(-spread, spread, progress)), stance ? 0 : -Math.sin(progress * Math.PI) * lift);
  }
  function groundedLeg(ctx, p, hip, foot, far) {
    // A standing leg is nearly straight; the lifted return bends at the knee.
    // Do not impose the longer, folded cycling limb lengths on this silhouette.
    const lift = Math.max(0, -foot[1]);
    const knee = add(mix(hip, add(foot, -1, -4), 0.52), 0.5 + lift * 0.7, -lift * 0.2);
    leg(ctx, p, hip, foot, far, 9, 9, knee);
  }
  function standingPose(time, options, action, expression) {
    const progress = unit(options.phase, 1), u = ease(progress);
    const moving = action === 'walk' || action === 'run', running = action === 'run';
    const c = moving ? cycle(time, running ? 0.48 : 0.84) : 0;
    const swing = moving ? Math.cos(c * TAU) : 0;
    const bob = moving ? -Math.round(Math.abs(Math.sin(c * TAU)) * (running ? 2 : 1)) : 0;
    const droop = (expression === 'worry' ? 1 : 0) + (action === 'think' ? Math.round(2 * u) : 0);
    const hip = point(0, -15 + bob);
    const shoulders = point(running ? 3 : 0, -26 + bob + droop);
    const headAt = point(shoulders[0] + (expression === 'resolve' ? 1 : 0) + (action === 'think' || action === 'study' ? Math.round(2 * u) : 0), -40 + bob + Math.min(2, droop) + (action === 'study' ? Math.round(u) : 0));
    const farFoot = moving ? stepFoot((c + 0.5) % 1, running ? 9 : 5, running ? 7 : 4, -3) : [-4, 0];
    const nearFoot = moving ? stepFoot(c, running ? 9 : 5, running ? 7 : 4, 3) : [3, 0];
    const far = { root: add(shoulders, -4, 1), elbow: add(shoulders, -7, 6), hand: add(shoulders, -7, 11) };
    const near = { root: add(shoulders, 4, 1), elbow: add(shoulders, 7, 7), hand: add(shoulders, 6, 11) };
    let nearKind = 'relaxed', farKind = 'relaxed', prop = null;
    if (moving) {
      far.elbow = add(shoulders, -5 + swing * (running ? 6 : 3), 6);
      near.elbow = add(shoulders, 5 - swing * (running ? 6 : 3), 6);
      far.hand = add(shoulders, -3 + swing * (running ? 10 : 5), running ? 2 - swing * 2 : 11);
      near.hand = add(shoulders, 3 - swing * (running ? 10 : 5), running ? 2 + swing * 2 : 11);
      nearKind = farKind = running ? 'grip' : 'relaxed';
    } else if (action === 'point') {
      near.elbow = mix(near.elbow, [12, -26], u);
      near.hand = mix(near.hand, [21, -29], u);
      nearKind = progress > 0.45 ? 'point' : 'relaxed';
      far.hand = mix(far.hand, [-6, -17], u);
    } else if (action === 'signal') {
      const lift = ease(progress, 0, 0.62), direct = ease(progress, 0.62, 1);
      near.elbow = mix(near.elbow, [10, -30], lift);
      near.hand = mix(mix(near.hand, [12, -36], lift), [18, -33], direct);
      nearKind = progress > 0.3 ? 'signal' : 'relaxed';
      far.hand = mix(far.hand, [-5, -19], u);
    } else if (action === 'think') {
      near.elbow = mix(near.elbow, [10, -21], u);
      near.hand = mix(near.hand, add(headAt, 3, 10), u);
      far.elbow = mix(far.elbow, [-6, -16], u);
      far.hand = mix(far.hand, [6, -19], u);
      nearKind = 'grip';
    } else if (action === 'unfold') {
      prop = { type: 'map', shape: mapShape(progress) };
      const { left, top, width, height } = prop.shape;
      far.elbow = mix(far.elbow, [left - 3, top + 4], ease(progress, 0, 0.35));
      far.hand = mix(far.hand, [left, top + height - 4], ease(progress, 0, 0.22));
      near.elbow = point(10, top + 2);
      near.hand = point(left + width - 1, top + height - 4);
      farKind = nearKind = 'grip';
    } else if (action === 'study') {
      prop = { type: 'book', shape: bookShape(progress) };
      const { x, y, half } = prop.shape;
      far.elbow = mix(far.elbow, [-6, -18], u);
      far.hand = point(x - half, y + 8);
      near.elbow = mix(near.elbow, [13, -21], u);
      near.hand = point(x + half, y + 8);
      farKind = nearKind = 'grip';
    } else if (expression === 'worry') {
      near.elbow = add(shoulders, 7, 6);
      near.hand = add(shoulders, 1, 4);
      nearKind = 'grip';
    }
    return { hip, shoulders, headAt, farFoot, nearFoot, far, near, nearKind, farKind, prop,
      scarfMotion: moving ? Math.sin(c * TAU) * 1.5 : 0,
      bagSwing: moving ? swing * (running ? 2 : 1) : 0,
      wind: running ? 1 : moving ? 0.35 : 0 };
  }
  function drawStanding(ctx, p, identity, expression, pose) {
    scarfTail(ctx, p, pose.shoulders, pose.scarfMotion, pose.wind);
    groundedLeg(ctx, p, add(pose.hip, -2, 0), pose.farFoot, true);
    arm(ctx, p, pose.far, true);
    groundedLeg(ctx, p, add(pose.hip, 2, 0), pose.nearFoot, false);
    torso(ctx, p, identity, pose.hip, pose.shoulders, pose.bagSwing);
    head(ctx, p, identity, expression, pose.headAt);
    collar(ctx, p, pose.shoulders);
    arm(ctx, p, pose.near);
    if (pose.prop) {
      if (pose.prop.type === 'map') paperMap(ctx, p, pose.prop.shape);
      else openBook(ctx, p, pose.prop.shape);
    }
    // Fingers are last, visibly wrapped over page edges or touching the chin.
    hand(ctx, p, pose.far.hand, pose.farKind);
    hand(ctx, p, pose.near.hand, pose.nearKind);
  }
  function ridingPose(angle, effort, moving) {
    const crank = [0, -13], radius = 6;
    const nearFoot = point(crank[0] + Math.cos(angle) * radius, crank[1] + Math.sin(angle) * radius);
    const farFoot = point(crank[0] - Math.cos(angle) * radius, crank[1] - Math.sin(angle) * radius);
    const hip = [-7, -28], shoulders = point(lerp(4, 7, effort), lerp(-37, -36, effort));
    return {
      crank, hip, shoulders, headAt: add(shoulders, 3, -11), nearFoot, farFoot,
      far: { root: add(shoulders, -3, 1), elbow: [14, -31], hand: [22, -36] },
      near: { root: add(shoulders, 4, 1), elbow: [18, -29], hand: [27, -35] },
      scarfMotion: moving ? Math.sin(angle) : 0,
      bagSwing: moving ? Math.cos(angle) : 0,
      wind: moving ? 0.45 + effort * 0.45 : 0
    };
  }
  function riderTorso(ctx, p, identity, expression, pose) {
    torso(ctx, p, identity, pose.hip, pose.shoulders, pose.bagSwing);
    head(ctx, p, identity, expression, pose.headAt);
    collar(ctx, p, pose.shoulders);
  }
  function person(ctx, x, groundY, time, options = {}) {
    options = objectOf(options);
    placed(ctx, x, groundY, options, () => {
      const identity = owns(IDENTITIES, options.identity) ? options.identity : 'hero';
      const expression = choose(options.expression, EXPRESSIONS, 'hope');
      const action = choose(options.action, ACTIONS, 'idle'), p = colors(identity, options.palette);
      if (action !== 'ride') {
        drawStanding(ctx, p, identity, expression, standingPose(time, options, action, expression));
        return;
      }
      const pose = ridingPose(cycle(time, 0.84, unit(options.phase, 0)) * TAU, 0.35, true);
      // Standalone seated figure only; the integrated bicycle never calls person.
      ctx.translate(0, -Math.max(pose.farFoot[1], pose.nearFoot[1]));
      scarfTail(ctx, p, pose.shoulders, pose.scarfMotion, pose.wind);
      leg(ctx, p, pose.hip, pose.farFoot, true, 11, 12);
      arm(ctx, p, pose.far, true);
      riderTorso(ctx, p, identity, expression, pose);
      leg(ctx, p, pose.hip, pose.nearFoot, false, 11, 12);
      arm(ctx, p, pose.near);
      hand(ctx, p, pose.far.hand, 'grip');
      hand(ctx, p, pose.near.hand, 'grip');
    });
  }
  function wheel(ctx, p, center, angle) {
    const [cx, cy] = center, radius = 12;
    // Concentric annuli leave the scene visible through the spokes.
    for (let y = -radius; y < radius; y++) {
      for (let x = -radius; x < radius; x++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d > radius || d < 8.7) continue;
        const color = d > 11.1 ? p.ink : d > 9.9 ? p.tire : p.rim;
        rect(ctx, color, cx + x, cy + y, 1, 1);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = angle + i * TAU / 8;
      const end = point(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
      line(ctx, i % 2 ? p.metal : p.rim, center, end);
    }
    const reflector = point(cx + Math.cos(angle + 0.4) * 6, cy + Math.sin(angle + 0.4) * 6);
    rect(ctx, p.scarfLight, reflector[0], reflector[1], 2, 1);
    rect(ctx, p.ink, cx - 2, cy - 2, 4, 4);
    rect(ctx, p.metal, cx - 1, cy - 1, 2, 2);
  }
  function tube(ctx, p, a, b, color = p.frame, width = 2) {
    line(ctx, p.ink, a, b, width + 2);
    line(ctx, color, a, b, width);
  }
  function parcel(ctx, p, x, y, width, height, label) {
    polygon(ctx, p.ink, [[x + 1, y], [x + width - 2, y], [x + width, y + 2], [x + width, y + height], [x, y + height], [x, y + 1]]);
    rect(ctx, p.parcel, x + 1, y + 1, width - 2, height - 2);
    rect(ctx, p.parcelShade, x + width - 4, y + 2, 3, height - 3);
    rect(ctx, p.tape, x + Math.floor(width * 0.45), y + 1, 2, height - 2);
    line(ctx, p.parcelShade, [x + 1, y + 2], [x + width - 2, y + 2]);
    if (label) {
      rect(ctx, p.paper, x + 2, y + 4, 5, 3);
      rect(ctx, p.mapInk, x + 3, y + 5, 3, 1);
    }
  }
  function cargo(ctx, p) {
    tube(ctx, p, [-35, -26], [-13, -26], p.teal);
    line(ctx, p.metal, [-33, -26], [-26, -12]);
    line(ctx, p.metal, [-16, -26], [-26, -12]);
    parcel(ctx, p, -35, -35, 21, 9, true);
    parcel(ctx, p, -32, -43, 16, 8, false);
    line(ctx, p.strap, [-30, -42], [-30, -27]);
    line(ctx, p.strap, [-19, -42], [-19, -27]);
    rect(ctx, p.scarfLight, -31, -30, 3, 2);
    rect(ctx, p.book, -37, -27, 2, 3);
  }
  function chainAndFrame(ctx, p) {
    // Exposed chain, rear sprocket and crank ring, rather than a filled block.
    const chain = [[-27, -14], [-2, -18], [4, -17], [5, -12], [1, -9], [-27, -10], [-29, -12], [-27, -14]];
    for (let i = 0; i + 1 < chain.length; i++) line(ctx, p.ink, chain[i], chain[i + 1], 2);
    for (let i = 0; i + 1 < chain.length; i++) line(ctx, p.metal, chain[i], chain[i + 1]);
    for (let x = -24; x < -3; x += 4) rect(ctx, p.rim, x, -10, 1, 1);
    const rear = [-26, -12], seat = [-9, -25], crank = [0, -13], steering = [17, -27], front = [26, -12];
    tube(ctx, p, rear, seat, p.frameShade);
    tube(ctx, p, rear, crank, p.frameShade);
    tube(ctx, p, seat, steering);
    tube(ctx, p, steering, crank);
    tube(ctx, p, seat, crank);
    tube(ctx, p, steering, front, p.teal, 3);
    line(ctx, p.jacketLight, [19, -23], [24, -14]);
    line(ctx, p.scarfLight, [-7, -25], [12, -27]);
    // Mudguards are thin stepped arcs, preserving the visible wheel interiors.
    for (const cx of [-26, 26]) {
      line(ctx, p.teal, [cx - 9, -20], [cx - 5, -24], 2);
      line(ctx, p.teal, [cx - 5, -24], [cx + 5, -24], 2);
      line(ctx, p.teal, [cx + 5, -24], [cx + 9, -20], 2);
      rect(ctx, p.jacketLight, cx - 4, -25, 7, 1);
    }
    tube(ctx, p, [-9, -25], [-9, -29], p.metal);
    polygon(ctx, p.ink, [[-14, -30], [-4, -30], [-1, -28], [-3, -27], [-13, -27]]);
    rect(ctx, p.bagShade, -12, -29, 8, 1);
    // Rigid bike stem, bar, two grips, bell and a visible brake cable.
    tube(ctx, p, [17, -27], [17, -33], p.metal);
    tube(ctx, p, [17, -33], [22, -35], p.metal);
    line(ctx, p.metal, [22, -35], [27, -35], 2);
    line(ctx, p.ink, [20, -36], [24, -36], 2);
    line(ctx, p.ink, [25, -35], [29, -35], 2);
    rect(ctx, p.scarfLight, 19, -36, 2, 2);
    line(ctx, p.ink, [24, -33], [24, -28]);
    line(ctx, p.ink, [24, -28], [21, -23]);
    rect(ctx, p.ink, 23, -28, 5, 4);
    rect(ctx, p.paper, 25, -27, 3, 2);
    rect(ctx, p.book, -3, -23, 5, 2);
    rect(ctx, p.paper, -2, -23, 2, 1);
  }
  function pedal(ctx, p, crank, foot, far) {
    line(ctx, p.ink, crank, foot, 3);
    line(ctx, far ? p.metal : p.rim, crank, foot);
    rect(ctx, p.ink, foot[0] - 3, foot[1], 7, 2);
    rect(ctx, p.metal, foot[0] - 2, foot[1], 5, 1);
    rect(ctx, p.scarfLight, foot[0] + 2, foot[1], 1, 1);
  }
  function bicycle(ctx, x, groundY, time, options = {}) {
    options = objectOf(options);
    placed(ctx, x, groundY, options, () => {
      const p = colors('hero', options.palette), effort = unit(options.effort, 0.35);
      const expression = choose(options.expression, EXPRESSIONS, 'hope');
      const moving = options.moving !== false, hasRider = options.rider !== false;
      const offset = unit(options.phase, 0), period = lerp(1.12, 0.54, effort);
      const rotation = moving ? cycle(time, period, offset) : offset;
      const angle = rotation * TAU, pose = ridingPose(angle, effort, moving);
      // One crank revolution drives two wheel revolutions through the chain.
      wheel(ctx, p, [-26, -12], angle * 2);
      wheel(ctx, p, [26, -12], angle * 2);
      cargo(ctx, p);
      pedal(ctx, p, pose.crank, pose.farFoot, true);
      if (hasRider) {
        scarfTail(ctx, p, pose.shoulders, pose.scarfMotion, pose.wind);
        leg(ctx, p, pose.hip, pose.farFoot, true, 11, 12);
        arm(ctx, p, pose.far, true);
      }
      chainAndFrame(ctx, p);
      if (hasRider) riderTorso(ctx, p, 'hero', expression, pose);
      pedal(ctx, p, pose.crank, pose.nearFoot, false);
      if (hasRider) {
        leg(ctx, p, pose.hip, pose.nearFoot, false, 11, 12);
        arm(ctx, p, pose.near);
        hand(ctx, p, pose.far.hand, 'grip');
        hand(ctx, p, pose.near.hand, 'grip');
      }
      rect(ctx, p.ink, pose.crank[0] - 2, pose.crank[1] - 2, 4, 4);
      rect(ctx, p.rim, pose.crank[0] - 1, pose.crank[1] - 1, 2, 2);
    });
  }
  return { person, bicycle };
}