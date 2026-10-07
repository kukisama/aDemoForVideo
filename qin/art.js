/* Original, hand-authored 2D pixel artwork. No historical glyph transcription.
 * Classic script: load before world.js. All exported painters preserve ctx state.
 * Shapes are scan-converted onto integer pixels; no antialiased vector outlines.
 */
var QinArt = (function () {
  'use strict';
  const W = 768, H = 432;
  const C = Object.freeze({
    ink: '#10191d', black: '#121419', deep: '#1b2228', blue: '#233c4b',
    sea: '#365867', mist: '#829c9b', pale: '#c8c9ae', gold: '#b39357',
    light: '#dfc184', red: '#803d32', vermilion: '#af5740', jade: '#567866',
    leaf: '#809577', earth: '#78614c', clay: '#a17453', skin: '#bd9570',
    skinLight: '#d6af85', skinShade: '#89634e', bamboo: '#b19d64'
  });
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  // Position-indexed hash, never a mutable random generator.
  function hash(i, seed = 0) {
    let n = Math.imul((i | 0) ^ Math.imul(seed | 0, 374761393), 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function create(ctx) {
    const I = Math.round;
    function rect(x, y, w, h, c) {
      x = I(x); y = I(y); w = I(w); h = I(h);
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
    }
    function poly(points, c) {
      const p = points.map(v => [I(v[0]), I(v[1])]);
      const lo = Math.max(0, Math.min(...p.map(v => v[1])));
      const hi = Math.min(H - 1, Math.max(...p.map(v => v[1])));
      ctx.fillStyle = c;
      for (let y = lo; y <= hi; y++) {
        const crosses = [];
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const a = p[i], b = p[j], sy = y + .5;
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy))
            crosses.push(a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        crosses.sort((a, b) => a - b);
        for (let i = 0; i + 1 < crosses.length; i += 2) {
          const left = Math.ceil(crosses[i] - .5), right = Math.ceil(crosses[i + 1] - .5);
          ctx.fillRect(left, y, right - left, 1);
        }
      }
    }
    function line(x0, y0, x1, y1, c, width = 1) {
      x0 = I(x0); y0 = I(y0); x1 = I(x1); y1 = I(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      ctx.fillStyle = c; width = Math.max(1, I(width));
      for (;;) {
        ctx.fillRect(x0, y0, width, width);
        if (x0 === x1 && y0 === y1) break;
        const e = 2 * err;
        if (e >= dy) { err += dy; x0 += sx; }
        if (e <= dx) { err += dx; y0 += sy; }
      }
    }
    function ellipse(x, y, rx, ry, c) {
      rx = Math.max(1, I(rx)); ry = Math.max(1, I(ry)); x = I(x); y = I(y);
      for (let dy = -ry; dy <= ry; dy++) {
        const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry))));
        rect(x - dx, y + dy, 2 * dx + 1, 1, c);
      }
    }
    function texture(x, y, w, h, seed, colors, count = 90, long = false) {
      for (let i = 0; i < count; i++) {
        const px = x + Math.floor(hash(i * 4, seed) * Math.max(1, w - 8));
        const py = y + Math.floor(hash(i * 4 + 1, seed) * Math.max(1, h - 3));
        rect(px, py, 1 + hash(i * 4 + 2, seed) * (long ? 19 : 4), 1 + hash(i, seed + 2) * 2,
          colors[Math.floor(hash(i * 4 + 3, seed) * colors.length)]);
      }
    }
    function wood(x, y, w, h, seed = 5, dark = true) {
      if (w <= 0 || h <= 0) return;
      const cs = dark ? ['#22282a', '#30302c', '#171c20', '#414033'] : ['#5a4130', '#745037', '#42382c', '#966746'];
      ctx.save();
      ctx.beginPath(); ctx.rect(I(x), I(y), I(w), I(h)); ctx.clip();
      try {
      rect(x, y, w, h, cs[0]);
      if (w > h * 3) {
        for (let row = 3; row < h; row += 6) {
          line(x + 2, y + row, x + w - 3, y + row, row % 3 ? cs[1] : cs[2]);
          for (let i = 0; i < 9; i++) {
            const xx = x + hash(i + row * 3, seed) * w;
            line(xx, y + row + 2, xx + 8 + hash(i, seed) * 27, y + row + 2, cs[2]);
          }
        }
        line(x, y, x + w - 1, y, cs[3]);
        return;
      }
      for (let xx = x + 4; xx < x + w; xx += 28) {
        rect(xx, y, 2, h, cs[2]); rect(xx + 3, y, 1, h, cs[1]);
        for (let k = 0; k < 5; k++) {
          const yy = y + hash(k + I(xx), seed) * Math.max(1, h - 30);
          line(xx + 8, yy, xx + 8, yy + 9 + hash(k, seed) * 26, cs[1]);
          rect(xx + 17, yy + 3, 1, 17, cs[2]);
        }
      }
      texture(x + 2, y + 2, w - 4, h - 4, seed, [cs[1], cs[2]], w * h / 550, true);
      line(x, y, x + w - 1, y, cs[3]);
      } finally { ctx.restore(); }
    }
    function ridge(y, amp, color, seed = 1, step = 8) {
      const points = [[0, H]];
      for (let x = 0; x <= W + step; x += step) {
        const q = x / W;
        const yy = I(y - amp * (.45 + .25 * Math.sin(q * 12 + seed) + .16 * Math.sin(q * 31 + seed * 2)) - hash(x, seed) * amp * .13);
        points.push([x, yy], [x + step, yy]);
      }
      points.push([W, H]); poly(points, color);
    }
    function sky(mode = 'dawn') {
      const palettes = {
        dawn: ['#718c8c', '#8eaaa1', '#b7c2ab', '#d7d3af', '#e7d5a4'],
        cold: ['#273e4b', '#3d5964', '#627c80', '#84968d', '#a5ab95'],
        dusk: ['#343b47', '#615653', '#927560', '#ba946f', '#c9a77b'],
        sea: ['#223c50', '#38566b', '#577785', '#829999', '#a7b4a8']
      };
      const p = palettes[mode] || palettes.dawn;
      rect(0, 0, W, H, p[4]);
      for (let i = 0; i < 4; i++) rect(0, i * 40, W, 40, p[i]);
      for (let i = 0; i < 20; i++) {
        const x = hash(i, 43) * W, y = 25 + hash(i, 24) * 111;
        rect(x, y, 16 + hash(i, 72) * 107, 1 + (i % 3), p[Math.min(3, Math.floor(y / 40) + 1)]);
      }
    }
    function landscape(mode = 'dawn') {
      sky(mode);
      const p = mode === 'dusk' ? ['#817361', '#645e50', '#434f45', '#303e36']
        : mode === 'sea' ? ['#6f8990', '#4b6d79', '#315460', '#233e49']
          : ['#869c92', '#627e77', '#405f58', '#284941'];
      ridge(198, 48, p[0], 3, 8); ridge(240, 66, p[1], 8, 7);
      ridge(290, 51, p[2], 6, 6); ridge(380, 54, p[3], 2, 6);
      for (let i = 0; i < 6; i++) {
        const x = i < 3 ? 34 + i * 41 : 632 + (i - 3) * 37;
        tree(x, 339 + hash(i, 13) * 18, .38 + hash(i, 16) * .38, i, mode === 'dusk');
      }
      texture(0, 372, 768, 57, 33, [p[2], p[3]], 47, true);
    }
    function tree(x, y, s = 1, seed = 0, autumn = false) {
      const p = v => v.map(([u, v]) => [x + u * s, y + v * s]);
      poly(p([[-4, 1], [-2, -37], [4, -64], [7, -64], [3, -35], [5, 1]]), '#39483b');
      for (let j = 0; j < 4; j++) {
        const yy = -31 - j * 13, wide = 28 - j * 4, off = (hash(j, seed) - .5) * 13;
        const shape = [[off - wide, yy + 9], [off - wide + 6, yy + 5], [off - wide + 6, yy + 1],
          [off - 9, yy - 2], [off - 4, yy - 9], [off + 3, yy - 9], [off + 11, yy - 3],
          [off + wide - 6, yy], [off + wide - 6, yy + 5], [off + wide, yy + 9]];
        poly(p(shape), autumn ? '#686c4d' : '#3d6050');
        line(x + (off - wide + 7) * s, y + (yy + 3) * s, x + (off + 7) * s, y + (yy + 3) * s,
          autumn ? '#a09262' : '#729071', Math.max(1, s));
        rect(x + (off + 10) * s, y + (yy + 5) * s, 6 * s, 2 * s, autumn ? '#8f8558' : '#577b5d');
      }
    }
    function roof(x, y, w, h, seed = 1, faded = false) {
      const body = faded ? '#5e6658' : '#293b3d', tile = faded ? '#78816a' : '#415253';
      // Low, wide, almost straight eaves: no Qing upturned yellow-tile silhouette.
      poly([[x - 9, y + h], [x + 7, y + h - 7], [x + w * .2, y + 4],
        [x + w * .22, y], [x + w * .77, y], [x + w - 7, y + h - 7], [x + w + 9, y + h]], C.ink);
      poly([[x, y + h - 5], [x + w * .22, y + 3], [x + w * .77, y + 3], [x + w, y + h - 5]], body);
      for (let j = 4; j < h - 4; j += 4) {
        const inset = w * .21 * (1 - j / h);
        line(x + inset, y + j, x + w - inset, y + j, tile);
        for (let k = x + inset + 7; k < x + w - inset; k += 13) rect(k, y + j, 2, 2, body);
      }
      rect(x - 9, y + h - 2, w + 18, 3, '#192b2e');
      rect(x + w * .22, y, w * .55, 2, faded ? '#a19c78' : '#697269');
      texture(x + w * .3, y + 6, w * .4, Math.max(3, h - 12), seed, [body, tile], 10);
    }
    function palace(x, y, w, h, seed = 0, faded = false) {
      const top = Math.max(8, h * .27), bottom = y + h;
      rect(x + 4, y + top, w - 8, h - top, faded ? '#6d7360' : '#726b52');
      rect(x + 10, y + top + 7, w - 20, h - top - 9, faded ? '#485548' : '#273131');
      if (w > 120) {
        const bay = (w - 28) / 6;
        for (let i = 0; i < 6; i++) {
          if (i === 2 || i === 3) continue;
          const bx = x + 16 + bay * i, by = y + top + 13, bh = h - top - 24;
          rect(bx, by, bay - 10, bh, faded ? '#616851' : '#534b3c');
          for (let j = 0; j < 4; j++) rect(bx + 3 + j * (bay - 16) / 4, by + 3, 1, bh * .56, '#a28c60');
          for (let j = 0; j < 3; j++) rect(bx + 3, by + 5 + j * bh * .16, bay - 16, 1, '#8e8058');
          rect(bx + 3, by + bh * .65, bay - 16, 2, '#8e8058');
        }
        rect(x + w * .38, y + top + 9, w * .25, 4, faded ? '#898b6d' : '#916444');
        texture(x + 12, bottom - 8, w - 24, 7, seed + 86, ['#5d6757', '#979578'], 29, true);
      }
      for (let i = 0; i < 7; i++) {
        const px = x + 12 + (w - 28) * i / 6;
        rect(px, y + top, Math.max(2, w / 48), h - top, faded ? '#78775f' : '#783f33');
        rect(px + 1, y + top, 1, h - top - 3, faded ? '#939076' : '#aa7350');
        rect(px - 2, y + top + 2, Math.max(5, w / 35), 4, '#ad9661');
        if (w > 180) { rect(px - 5, y + top + 7, 13, 3, '#614e37'); rect(px - 2, y + top + 10, 7, 4, '#a38354'); }
      }
      roof(x, y, w, top, seed, faded);
      rect(x - 8, bottom, w + 16, 5, faded ? '#898974' : '#a39877');
      rect(x - 12, bottom + 5, w + 24, 5, '#5c6459');
      for (let i = 0; i < 4; i++) rect(x + w * .3 - i * 4, bottom + 8 + i * 3, w * .4 + i * 8, 2, '#aca78b');
    }
    function stud(x, y, r = 6) {
      ellipse(x + 1, y + 2, r + 1, r + 1, '#101a1c');
      ellipse(x, y, r, r, '#5c563a'); ellipse(x - 1, y - 1, Math.max(1, r - 2), Math.max(1, r - 2), '#a1844c');
      rect(x - r / 2, y - r / 2, Math.max(1, r / 2), 2, '#d2b774');
      rect(x + 2, y + 2, 2, 2, '#4d634f');
    }
    function gate(open = 0, seam = 0, latch = 0, empty = false) {
      const shift = I(open * 302), l = -shift, r = 389 + shift;
      // Opening is physically empty, showing the already-painted world behind.
      wood(l, 23, 378, 380, 31); wood(r, 23, 379, 380, 32);
      rect(376 - shift, 25, 9, 375, '#090f13'); rect(r - 5, 25, 5, 375, '#090f13');
      if (open < .002) {
        rect(383, 27, 2 + seam, 359, '#d3b879'); rect(381, 80, 1, 198, '#5f694f');
      }
      [l, r].forEach((xx, side) => {
        rect(xx + 26, 32, 12, 364, '#4a4534'); rect(xx + 28, 32, 2, 364, '#827248');
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++)
          stud(xx + 74 + col * 72, 81 + row * 68, 6);
        rect(xx + 19, 228, 340, 36, '#10181a'); wood(xx + 20 + (side ? 0 : latch), 232, 337, 26, side + 91, false);
        [93, 306].forEach(dx => { rect(xx + dx, 224, 19, 45, '#4b533e'); rect(xx + dx + 2, 226, 4, 41, '#9c8954'); stud(xx + dx + 11, 232, 3); });
        if (!empty) { rect(xx + 172, 236, 34, 2, '#b08250'); rect(xx + 174, 254, 46, 1, '#2e2923'); }
      });
      wood(0, 5, W, 23, 92); wood(0, 26, 29, 376, 18); wood(739, 26, 29, 376, 19);
      rect(27, 28, 3, 367, '#746243'); rect(738, 28, 2, 367, '#776944');
      rect(0, 391, W, 41, '#161e20'); rect(0, 391, W, 4, '#77745c');
    }
    function hand(x, y, s = 1, side = 1, pose = 'reach', young = false, bare = false) {
      // Anchor is wrist; fingers point up. Explicit palm, four knuckles, bent digits,
      // thumb saddle and cuff; not an oval glued to a moving rectangle.
      const p = pts => pts.map(([a, b]) => [x + a * s * side, y + b * s]);
      const box = (a, b, w, h, c) => rect(x + (side > 0 ? a : -a - w) * s, y + b * s, w * s, h * s, c);
      const edge = '#362e2b', skin = young ? '#c7a27d' : C.skin;
      if (pose === 'drop') {
        poly(p([[-27, -2], [-35, 72], [36, 75], [24, -2]]), '#172128');
        poly(p([[-19, 0], [-17, 27], [-11, 37], [17, 36], [23, 23], [17, -3]]), edge);
        poly(p([[-15, 0], [-13, 26], [-8, 33], [14, 33], [18, 22], [13, 0]]), skin);
        for (let i = 0; i < 4; i++) {
          const fx = -12 + i * 8, end = 46 + [0, 7, 5, -2][i];
          poly(p([[fx, 25], [fx + 6, 25], [fx + 7, end - 4], [fx + 4, end], [fx, end - 1]]), edge);
          box(fx + 2, 29, 3, end - 31, skin); box(fx + 2, end - 5, 3, 3, '#d1ad84');
        }
        poly(p([[15, 6], [28, 20], [28, 31], [22, 34], [20, 23], [11, 17]]), skin);
        box(-21, -3, 43, 6, '#854735'); box(-20, -3, 41, 2, '#b5975f');
        return;
      }
      poly(p([[-34, 73], [-27, 24], [-21, 12], [19, 12], [29, 37], [40, 76]]), bare ? '#645743' : '#10191e');
      poly(p([[-26, 58], [-23, 26], [-17, 20], [16, 20], [22, 37], [29, 76]]), bare ? '#917552' : '#253139');
      poly(p([[-24, 28], [-19, 14], [18, 14], [23, 29], [2, 35]]), bare ? '#a18862' : '#803f33');
      box(-17, 24, 30, 2, bare ? '#c4a879' : '#b08d53');
      if (pose === 'write') {
        poly(p([[-15, 19], [-20, -4], [-12, -22], [-3, -29], [12, -24], [24, -12], [21, -4], [6, -11], [2, -6], [18, 0], [17, 15], [9, 23]]), edge);
        poly(p([[-12, 18], [-16, -4], [-10, -19], [-2, -25], [10, -20], [19, -12], [18, -8], [4, -15], [-2, -8], [13, 2], [12, 14], [7, 20]]), skin);
        poly(p([[-10, -7], [-3, -14], [2, -11], [-4, -3], [9, 7], [6, 12], [-5, 9]]), C.skinLight);
        box(12, -13, 7, 3, '#dbc09a'); box(3, 3, 9, 2, C.skinShade);
        box(-11, 13, 11, 1, C.skinShade);
        return;
      }
      const curl = pose === 'grip' || pose === 'write', hang = pose === 'rest';
      poly(p([[-17, 19], [-20, -9], [-15, -27], [8, -32], [22, -16], [20, 9], [14, 22], [-6, 25]]), edge);
      poly(p([[-14, 19], [-17, -7], [-12, -24], [8, -27], [18, -13], [16, 8], [11, 20], [-5, 22]]), skin);
      poly(p([[3, -19], [13, -13], [13, 9], [8, 18], [4, 15]]), C.skinShade);
      poly(p([[-13, -8], [-8, -17], [-3, -14], [-5, 7], [-10, 12]]), C.skinLight);
      for (let i = 0; i < 4; i++) {
        const fx = -16 + i * 8, len = [16, 23, 21, 15][i];
        const top = curl ? -25 - (i % 2) * 3 : hang ? -24 - len * .45 : -24 - len;
        poly(p([[fx, -10], [fx - 1, top + 5], [fx + 1, top], [fx + 5, top - 1], [fx + 7, top + 3], [fx + 7, -11]]), edge);
        poly(p([[fx + 2, -11], [fx + 1, top + 6], [fx + 2, top + 2], [fx + 4, top + 2], [fx + 5, top + 5], [fx + 5, -12]]), skin);
        box(fx + 2, top + 4, 3, 4, C.skinLight);
        box(fx + 1, top + (curl ? 10 : 14), 5, 1, C.skinShade);
        if (curl) { box(fx + 1, -20, 5, 6, C.skinShade); box(fx + 2, -19, 4, 3, '#dec19c'); }
      }
      const tx = pose === 'write' ? 7 : 15;
      poly(p([[9, 8], [tx + 2, -6], [tx + 11, -18], [tx + 17, -16], [tx + 17, -10], [tx + 8, 4], [tx + 4, 14]]), edge);
      poly(p([[11, 8], [tx + 5, -4], [tx + 12, -15], [tx + 14, -13], [tx + 13, -9], [tx + 7, 3], [tx + 2, 11]]), skin);
      box(tx + 10, -14, 4, 5, C.skinLight);
      box(-5, 7, 12, 1, C.skinShade); box(-8, 11, 9, 1, C.skinShade);
      if (!young) { box(-13, 3, 2, 3, '#ad835f'); box(4, -7, 2, 2, '#ad835f'); }
      line(x - 19 * side * s, y + 36 * s, x - 12 * side * s, y + 53 * s, bare ? '#69563f' : '#36434a', Math.max(1, s));
    }
    function face(x, y, s = 1, clay = false, variant = 0, juvenile = false) {
      const P = pts => pts.map(([a, b]) => [x + a * s, y + b * s]);
      const R = (a, b, w, h, col) => rect(x + a * s, y + b * s, w * s, h * s, col);
      if (juvenile) {
        poly(P([[-15, -18], [-9, -25], [7, -25], [16, -16], [16, 9], [10, 22], [-8, 22], [-16, 10]]), '#574b3e');
        poly(P([[-12, -15], [-7, -21], [7, -21], [13, -13], [13, 9], [7, 19], [-6, 19], [-13, 8]]), '#d3ad80');
        poly(P([[8, -14], [13, -9], [13, 9], [7, 19], [3, 18], [7, 6]]), '#ad865f');
        R(-10, -4, 5, 2, '#55493b'); R(4, -4, 5, 2, '#55493b');
        R(-9, 1, 3, 3, '#27302b'); R(4, 1, 3, 3, '#27302b');
        R(-2, 6, 3, 4, '#e4be91'); R(-3, 13, 6, 1, '#8a5e43');
        poly(P([[-15, -8], [-17, -21], [-8, -30], [7, -29], [17, -18], [15, -7], [9, -19], [-8, -20]]), '#27332f');
        R(-4, -37, 9, 10, '#344339'); R(-3, -35, 7, 2, '#788066');
        R(-18, 1, 3, 8, '#c59e73'); R(15, 1, 3, 8, '#ad865f');
        return;
      }
      const base = clay ? ['#a17b5d', '#997657', '#aa8264'][variant % 3] : '#b49677';
      const shadow = clay ? '#735b49' : '#78604f', hi = clay ? '#be9a77' : '#cfb48e';
      poly(P([[-14, -20], [-6, -27], [8, -26], [16, -18], [17, 6], [11, 22], [0, 26], [-10, 21], [-17, 5]]), '#323433');
      poly(P([[-12, -18], [-5, -23], [8, -22], [13, -16], [14, 6], [9, 20], [0, 23], [-9, 18], [-14, 3]]), base);
      poly(P([[5, -19], [13, -14], [13, 6], [8, 20], [1, 22], [3, 9], [7, 5]]), shadow);
      poly(P([[-11, -15], [-3, -19], [2, -13], [-1, -3], [-9, 0]]), hi);
      R(-12, -6, 10, 2, '#463e34'); R(4, -6, 8, 2, '#463e34');
      R(-10, -2, 6, 1, '#282e2c'); R(5, -2, 5, 1, '#282e2c');
      R(-8, -1, 2, 1, hi); R(5, -1, 2, 1, hi);
      poly(P([[0, -5], [-2, 8], [4, 9], [4, 6], [1, 4], [2, -5]]), hi);
      R(-1, 9, 5, 1, '#574737'); R(-5, 14, 10, 1, '#4d4035'); R(-3, 16, 6, 1, hi);
      // Different moustaches, cheek creases, knots and left/right hair partings.
      if (variant % 3 !== 1) { R(-7, 11, 5, 2, shadow); R(3, 11, 5, 2, shadow); }
      if (variant % 2) poly(P([[-5, 19], [0, 27], [5, 19]]), shadow);
      R(-18, -4, 3, 10, base); R(15, -4, 3, 10, shadow);
      const hair = clay ? '#595247' : '#202b2c';
      poly(P([[-15, -15], [-17, -25], [-10, -30], [9, -30], [16, -24], [15, -12], [9, -23], [-4, -25]]), hair);
      const knot = variant % 2 ? 5 : -8;
      R(knot, -39, 11, 12, hair); R(knot + 2, -38, 7, 2, clay ? '#8a7860' : '#555646');
      for (let i = 0; i < 6; i++) R(-11 + i * 4, -28, 1, 5, clay ? '#8d785d' : '#45504a');
      if (clay) { R(-9, 6, 2, 2, '#80674f'); R(9, 1, 1, 6, '#bea083'); R(-4, 21, 3, 1, '#776650'); }
      if (s >= .8) {
        R(-13, -4, 1, 11, shadow); R(-11, 3, 1, 5, hi); R(-10, 7, 4, 1, hi);
        R(-4, -21, 8, 1, base); R(-6, -18, 10, 1, base); R(-4, -9, 3, 1, shadow);
        R(7, 2, 3, 1, base); R(8, 3, 2, 4, base); R(7, 13, 1, 5, '#67513f');
        R(-8, 12, 1, 5, shadow); R(-6, 17, 3, 1, shadow); R(-3, 19, 7, 1, hi);
        for (let i = 0; i < 27; i++) {
          const xx = -10 + hash(i, variant + 14) * 20, yy = -17 + hash(i, 42) * 34;
          if (Math.abs(xx) > 5 && Math.abs(yy) > 3) R(xx, yy, .5, .5, clay ? '#927356' : '#ac8a68');
        }
        if (clay) { R(10, -14, .5, 6, '#655743'); R(11, -9, 2, .5, '#655743'); }
      }
    }
    function figure(x, foot, s = 1, opts = {}) {
      const { variant = 0, walk = 0, role = 'citizen', bow = 0, load = false, back = false, noArms = false } = opts;
      const clay = role === 'clay', soldier = role === 'soldier' || clay;
      const body = clay ? ['#786651', '#8a7057', '#826c59'][variant % 3]
        : soldier ? '#3e4c47' : ['#555f50', '#805247', '#5b6970', '#a08d68'][variant % 4];
      const stride = Math.sin(walk) * 6, dip = Math.abs(Math.sin(walk)) * 1.5;
      const P = pts => pts.map(([a, b]) => [x + a * s, foot + (b + dip) * s]);
      const R = (a, b, w, h, col) => rect(x + a * s, foot + (b + dip) * s, w * s, h * s, col);
      poly(P([[-9, -26], [-1, -24], [-3 + stride, -2], [-13 + stride, -2]]), clay ? '#79624e' : '#253235');
      poly(P([[2, -25], [9, -26], [12 - stride, -2], [3 - stride, -2]]), clay ? '#907155' : '#35413c');
      R(-14 + stride, -3, 12, 3, clay ? '#695744' : C.ink); R(3 - stride, -3, 13, 3, clay ? '#695744' : C.ink);
      // Neck overlaps both jaw and collar at every portrait/formation scale.
      R(-4 + bow * 2, -73 + bow * 2, 9, 13, clay ? '#927457' : '#a98c6b');
      R(3 + bow * 2, -71 + bow * 2, 2, 10, clay ? '#695744' : '#715c49');
      poly(P([[-11, -67], [-18, -56], [-22, -29], [-8, -25], [3, -23], [19, -27], [15, -57], [8, -68]]), '#202b2d');
      poly(P([[-10, -64], [-16, -53], [-18, -31], [0, -27], [15, -30], [12, -53], [7, -64]]), body);
      if (!back) poly(P([[-7, -65], [7, -58], [-4, -43], [-6, -29], [1, -28], [3, -46], [11, -58], [5, -64]]), clay ? '#ac8a66' : '#b29c73');
      for (let i = 0; i < 4; i++) R(-11 + i * 6, -39, 1, 9 + (i % 2) * 3, clay ? '#645844' : '#424d40');
      if (soldier) {
        for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
          const xx = -12 + col * 6 + (row % 2), yy = -57 + row * 6;
          R(xx, yy, 5, 5, clay ? '#a18464' : '#5e6d60'); R(xx + 1, yy + 1, 1, 1, clay ? '#c0a17d' : '#9f9c72');
          R(xx, yy + 4, 5, 1, clay ? '#655746' : '#2b3a36');
        }
      } else { R(-10, -47, 23, 3, '#332f2b'); R(1, -46, 2, 13, '#bb9c68'); }
      const arm = clay ? (variant % 3) * 4 : Math.sin(walk) * 7;
      if (!noArms) {
      poly(P([[-13, -62], [-22, -56], [-25, -39 + arm], [-16, -34 + arm], [-12, -47]]), body);
      poly(P([[12, -62], [21, -54], [24, -41 - arm], [16, -36 - arm], [11, -48]]), body);
      R(-24, -37 + arm, 7, 6, clay ? '#ae8b67' : '#b19370');
      R(17, -39 - arm, 6, 6, clay ? '#ae8b67' : '#b19370');
      }
      if (back) {
        poly(P([[-7, -84], [-4, -88], [5, -87], [8, -80], [6, -70], [-4, -70], [-8, -77]]), '#24332f');
        R(variant % 2 ? 1 : -5, -93, 7, 7, '#293932'); R(-5, -81, 1, 8, '#57644c');
        R(-4, -69, 9, 3, '#a68f68'); R(-1, -62, 1, 15, '#8b8c64');
      } else face(x + bow * s * 3, foot + (-77 + dip + bow * 4) * s, s * (role === 'child' ? .4 : .34), clay, variant, role === 'child');
      if (role === 'official') { R(-7, -89 + bow * 4, 14, 7, '#172326'); R(-9, -91 + bow * 4, 17, 3, '#384640'); R(-5, -48, 10, 12, '#a39466'); }
      if (role === 'soldier') { line(x + 26 * s, foot - 7 * s, x + 26 * s, foot - 117 * s, '#817855', Math.max(1, 2 * s)); poly([[x + 23 * s, foot - 115 * s], [x + 26 * s, foot - 126 * s], [x + 29 * s, foot - 115 * s]], '#a5ada1'); }
      if (load) { poly(P([[-24, -60], [-33, -56], [-29, -36], [-21, -39]]), '#9d8659'); for (let i = 0; i < 4; i++) R(-31 + i * 2, -54, 1, 14, '#4c5140'); }
    }
    function horse(x, y, s = 1, phase = 0) {
      const p = pts => pts.map(([a, b]) => [x + a * s, y + b * s]);
      const stride = Math.sin(phase) * 10;
      for (let i = 0; i < 4; i++) {
        const a = -26 + i * 16, d = i % 2 ? stride : -stride;
        poly(p([[a, -28], [a + 6, -27], [a + 3 + d, -13], [a + 9 - d, 0], [a + 3 - d, 0], [a - 2 + d, -13]]), i % 2 ? '#463e33' : '#73604a');
      }
      poly(p([[-42, -44], [-28, -57], [19, -53], [32, -66], [35, -83], [44, -88], [50, -75], [64, -63], [62, -54], [49, -55], [38, -35], [22, -26], [-28, -28]]), '#75634f');
      poly(p([[-35, -48], [-24, -53], [15, -48], [17, -33], [-26, -33]]), '#907b5c');
      poly(p([[25, -55], [29, -70], [33, -87], [37, -88], [34, -62]]), '#263130');
      poly(p([[-42, -46], [-48, -39], [-49 - stride / 3, -16], [-44 - stride / 3, -17], [-43, -31], [-36, -42]]), '#2b3330');
      poly(p([[40, -83], [39, -97], [44, -90], [47, -78]]), '#5c503d');
      rect(x + 51 * s, y - 70 * s, 2 * s, 2 * s, '#142023');
      line(x + 30 * s, y - 59 * s, x + 59 * s, y - 57 * s, '#c2ad76', Math.max(1, s));
      poly(p([[-19, -54], [9, -52], [12, -29], [-22, -31]]), '#7e4636');
      line(x - 17 * s, y - 33 * s, x + 11 * s, y - 31 * s, '#bc995b', Math.max(1, s));
    }
    function wheel(x, y, r, phase) {
      ellipse(x, y, r + 3, r + 3, '#182626'); ellipse(x, y, r, r, '#91784e'); ellipse(x, y, r - 3, r - 3, '#343b31');
      for (let k = 0; k < 10; k++) {
        const a = phase + k * Math.PI / 5;
        line(x, y, x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2), '#b0945e', 2);
      }
      ellipse(x, y, 5, 5, '#c3a776'); ellipse(x, y, 2, 2, '#555844');
    }
    function banner(x, y, height, t, variant = 0) {
      line(x, y, x, y + height, '#8d835c', 2);
      const w = height * .36, wave = Math.sin(t * 2.1 + variant) * 5;
      poly([[x + 2, y + 3], [x + w * .6, y + 6 + wave], [x + w, y + 1], [x + w - 4, y + height * .35], [x + w * .5, y + height * .35 + wave], [x + 2, y + height * .32]], variant % 2 ? '#713d35' : '#263a3b');
      line(x + 4, y + 7, x + w - 4, y + 7 + wave / 2, '#bba063');
      glyph(x + w * .34, y + height * .08, Math.max(.45, height / 150), variant + 2, '#ad9060');
    }
    function glyph(x, y, s = 1, variant = 0, color = '#424535') {
      // Invented seal-like marks, decoration only. Never represented as deciphered Qin text.
      const patterns = [
        [[0, 0, 10, 0], [5, 0, 5, 16], [0, 6, 10, 6], [0, 6, 0, 12], [10, 6, 10, 12], [1, 16, 9, 16]],
        [[1, 0, 1, 15], [9, 0, 9, 15], [1, 5, 9, 5], [5, 5, 5, 18], [0, 12, 10, 12]],
        [[0, 2, 10, 2], [2, 2, 2, 14], [8, 2, 8, 14], [2, 8, 8, 8], [0, 17, 10, 17]],
        [[5, 0, 5, 18], [0, 4, 10, 4], [0, 4, 0, 11], [10, 4, 10, 11], [1, 14, 9, 14]]
      ];
      for (const [a, b, c, d] of patterns[((variant % 4) + 4) % 4])
        line(x + a * s, y + b * s, x + c * s, y + d * s, color, Math.max(1, s));
    }
    function bamboo(x, y, w, h, progress = 1, ink = 1) {
      const count = Math.max(1, Math.floor(w / 17)), visible = Math.ceil(count * clamp(progress));
      for (let i = 0; i < visible; i++) {
        const xx = x + i * 17, yy = y + (i % 3 === 0 ? 1 : 0);
        rect(xx + 2, yy + 3, 16, h + 3, '#202b24'); rect(xx, yy, 15, h, i % 3 ? '#b4a16b' : '#c2af76');
        rect(xx + 1, yy + 2, 2, h - 4, '#d4bf84'); rect(xx + 13, yy + 2, 2, h - 3, '#8a8057');
        texture(xx + 4, yy + 3, 8, h - 6, i + 84, ['#a99660', '#c4b079'], 5);
        for (let j = 0; j < Math.floor((h - 24) / 23); j++) if ((i * 3 + j) / (count * 3) < ink)
          glyph(xx + 4, yy + 12 + j * 23, .65, i + j);
        rect(xx - 1, yy + 8, 18, 2, '#4f5140'); rect(xx - 1, yy + h - 10, 18, 2, '#4f5140');
      }
    }
    function coin(x, y, r = 19, variant = 0) {
      ellipse(x + 1, y + 3, r, r, '#283d37'); ellipse(x, y, r, r, '#64735a');
      ellipse(x, y, r - 2, r - 2, '#a08e54'); ellipse(x, y, r - 5, r - 5, '#7e8254');
      const hole = Math.max(3, I(r * .3));
      rect(x - hole - 1, y - hole - 1, hole * 2 + 3, hole * 2 + 3, '#b4a061');
      rect(x - hole, y - hole, hole * 2 + 1, hole * 2 + 1, '#28382f');
      line(x - r + 5, y - 5, x - r + 7, y + 4, '#c0af72');
      rect(x + r - 6, y - 2, 2, 5, '#536a50');
      // Non-text weathering, not Qing cash inscriptions or a modern portrait.
      for (let i = 0; i < 9; i++) {
        const a = hash(i, variant + 4) * Math.PI * 2, rr = r * .69;
        rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2, 2, i % 2 ? '#526a51' : '#ad9a5c');
      }
    }
    function grass(x, y, s = 1, seed = 0, breeze = 0) {
      for (let j = 0; j < 7; j++) {
        const xx = x + (j - 3) * 3 * s, h = (5 + hash(j, seed) * 12) * s;
        line(xx, y, xx + (hash(j, seed + 1) * 6 - 3 + breeze) * s, y - h, j % 2 ? '#7c966d' : '#476a51', Math.max(1, s));
        if (j % 3 === 0) rect(xx + breeze * s, y - h, 2 * s, 2 * s, '#afac77');
      }
    }
    function group(alpha, painter) { ctx.globalAlpha *= clamp(alpha); painter(); }
    function text(str, x, y, size = 20, color = C.pale, align = 'center') {
      // Only used for the final title. All story captions belong to the parent DOM.
      ctx.fillStyle = color; ctx.font = `${size}px 'Qin Serif', 'Microsoft YaHei', serif`;
      ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(str, I(x), I(y));
    }
    const painters = { rect, poly, line, ellipse, texture, wood, ridge, sky, landscape, roof,
      palace, stud, gate, hand, face, figure, horse, wheel, banner, glyph, bamboo, coin, grass, tree, group, text };
    return Object.fromEntries(Object.entries(painters).map(([key, fn]) => [key, function (...args) {
      ctx.save();
      try { return fn(...args); } finally { ctx.restore(); }
    }]));
  }
  return Object.freeze({ W, H, C, clamp, ease, mix, hash, create });
}());