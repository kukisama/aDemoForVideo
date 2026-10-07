/* Original Qin first-person literary animation. Classic script, no imports.
 * Load art.js first, then call createQinWorld(canvas, storyData).
 * Only absolute story time drives poses, particles, camera and material changes.
 */
function createQinWorld(canvas, data) {
  'use strict';
  if (typeof QinArt === 'undefined') throw new Error('Load qin/art.js before qin/world.js');
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required');
  if (!data || data.duration !== 180 || !Array.isArray(data.shots) || data.shots.length !== 30 || !Array.isArray(data.chapters))
    throw new TypeError('Expected locked Qin data: duration=180, chapters and 30 shots');
  const { W, H, C, clamp, ease, mix, hash } = QinArt;
  const shots = data.shots.map(s => ({ ...s })), chapters = data.chapters.map(c => ({ ...c }));
  const target = canvas.getContext('2d');
  if (!target) throw new Error('Canvas 2D is unavailable');
  const surface = canvas.ownerDocument.createElement('canvas');
  surface.width = W; surface.height = H;
  const ctx = surface.getContext('2d');
  const a = QinArt.create(ctx);
  canvas.width = W; canvas.height = H;
  canvas.style.imageRendering = 'pixelated';
  target.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
  let state = { chapter: 'gate', shot: 'latch', pov: true, time: 0, progress: 0, poster: false, reduced: false };
  let reduced = false;
  const E = (t, start, end) => ease((t - start) / (end - start));
  const motion = (t, amp = 1) => Math.sin(t) * amp;

  function floor(y = 218, warm = false) {
    const cs = warm ? ['#8e8365', '#796f55', '#625b48', '#4e4c3e'] : ['#737b6b', '#606c61', '#505d54', '#3e4b46'];
    for (let i = 0; i < 4; i++) a.rect(0, y + i * (H - y) / 4, W, (H - y) / 4 + 1, cs[i]);
    for (let row = 0; row < 8; row++) {
      const yy = y + 7 + row * row * 4;
      a.line(0, yy, W, yy, row % 2 ? '#888a72' : '#343e38');
      for (let col = -5; col < 6; col++) {
        const x = 384 + col * (40 + row * 19) + (row % 2) * 24;
        a.line(x, yy, x + col * 6, yy + 6 + row * 8, '#424f45');
      }
    }
    a.texture(0, y + 9, W, H - y - 9, 32, ['#7b7e65', '#596456', '#424d42'], 105, true);
  }
  function court(quiet = false, advance = 0) {
    a.sky('cold'); a.ridge(181, 38, '#667e76', 9);
    a.palace(232, 83, 304, 114, 3);
    floor(222);
    // Continuous, low covered corridors, in hand-drawn perspective.
    for (const side of [-1, 1]) {
      const map = x => side < 0 ? x : W - x;
      a.poly([[map(0), 67], [map(270), 155], [map(262), 171], [map(0), 106]], '#263a3d');
      a.poly([[map(0), 107], [map(262), 171], [map(262), 187], [map(0), 139]], '#8b7652');
      for (let row = 0; row < 7; row++) {
        const d = row / 7, x = map(24 + d * 223), y = 110 + d * 69;
        const height = 175 - d * 134, width = 18 - d * 13;
        a.rect(x - width / 2, y, width, height, '#6d4235');
        a.rect(x - width / 2 + 2, y + 3, Math.max(1, width / 5), height - 3, '#a67651');
        a.rect(x - width * .7, y - 4, width * 1.4, 6, '#aa9769');
        a.rect(x - width * .8, y + height, width * 1.6, 7, '#999b7b');
        a.line(map(0), 75 + row * 4, map(252), 155 + row, '#42524b');
      }
    }
    a.poly([[341, 214], [427, 214], [500, 432], [268, 432]], quiet ? '#51473c' : '#855243');
    a.line(341, 214, 268, 432, '#c2aa74', 2); a.line(427, 214, 500, 432, '#c2aa74', 2);
    // Silence leaves a large empty centre, but the officials remain bowed.
    for (let row = 0; row < (quiet ? 5 : 7); row++) {
      const s = .31 + row * .12, foot = 235 + row * 17 + advance;
      for (const side of [-1, 1]) {
        const x = 384 + side * (82 + row * 23);
        a.figure(x, foot, s, { role: 'official', variant: row + (side > 0 ? 2 : 0), bow: quiet ? 1.4 : .15 });
        if (!quiet) a.figure(x + side * 40 * s, foot - 6, s * .9, { role: 'official', variant: row + 1 });
      }
    }
    // Framing beams; top remains below the reserved DOM title zone only on poster.
    a.wood(0, 0, W, 29, 39); a.rect(0, 29, W, 4, '#8f8055');
    a.wood(0, 27, 32, 334, 1); a.wood(736, 27, 32, 334, 2);
    if (quiet) a.group(.21, () => a.rect(0, 0, W, H, '#0d1820'));
  }
  function palaceSea(warm = true) {
    a.landscape(warm ? 'dawn' : 'cold');
    for (let row = 0; row < 4; row++) {
      const w = 80 + row * 36, y = 177 + row * 39;
      for (let col = -2; col < 3; col++) a.palace(384 + col * (w + 27) - w / 2, y, w, 25 + row * 9, row * 7 + col);
    }
    a.poly([[374, 183], [393, 183], [457, 409], [303, 409]], '#b6a584');
    for (let i = 0; i < 8; i++) a.line(371 - i * 7, 225 + i * 23, 397 + i * 7, 225 + i * 23, '#687566');
  }
  function rail(y = 314) {
    a.wood(0, y, W, 24, 47, false); a.rect(0, y, W, 3, '#b7985e');
    for (const x of [68, 229, 539, 700]) {
      a.wood(x, y + 21, 17, 93, x, false); a.stud(x + 8, y + 10, 5);
    }
  }
  function dust(t, x, y, seed = 1, strength = 1) {
    // Finite local event, not an ambient full-screen particle blanket.
    if (t < 0 || t > 1.5 || strength <= 0) return;
    const p = t / 1.5;
    a.group((1 - p) * strength * .65, () => {
      for (let i = 0; i < 12; i++) a.rect(x + (hash(i, seed) - .5) * p * 76, y - p * (10 + hash(i, seed + 1) * 29), 2 + (i % 3), 2, '#d2b98b');
    });
  }
  function threshold(seam = 0, slide = 0, absence = false) {
    a.rect(0, 0, W, H, '#111c20');
    a.gate(0, seam, 0, absence);
    a.wood(116 + slide, 286, 514, 28, 193, false);
    a.rect(117 + slide, 288, 511, 2, '#ba925c'); a.rect(117 + slide, 310, 511, 6, '#121c1e');
    for (const x of [197, 567]) {
      a.rect(x, 277, 23, 44, '#414c3d'); a.rect(x + 2, 280, 4, 37, '#a39360');
      a.stud(x + 13, 282, 4); a.stud(x + 13, 315, 4);
    }
    if (seam) a.poly([[386, 80], [390, 80], [404, 354], [387, 343]], '#877a50');
    a.rect(0, 410, W, 22, '#11191d');
  }
  function table(y = 254, dark = false) {
    a.wood(0, y, W, H - y, 217, dark);
    a.line(0, y + 5, W, y + 5, dark ? '#626144' : '#b08f5e', 2);
    for (let i = 0; i < 11; i++) a.line(i * 77 - 64, H, i * 63 + 22, y + 7, dark ? '#182425' : '#463a2d');
  }
  function studio(kind = 'script', t = 0) {
    a.rect(0, 0, W, H, kind === 'kiln' ? '#352b27' : '#1b292c');
    a.rect(46, 39, 217, 176, '#52695f');
    a.rect(50, 43, 209, 167, kind === 'kiln' ? '#715c44' : '#91a394');
    for (let i = 0; i < 7; i++) a.rect(56 + i * 30, 43, 5, 169, '#35443e');
    for (let i = 0; i < 5; i++) a.rect(50, 58 + i * 33, 209, 4, '#35443e');
    a.rect(403, 51, 306, 153, '#111e21');
    for (let row = 0; row < 3; row++) {
      a.wood(399, 73 + row * 55, 317, 7, row + 19);
      for (let k = 0; k < 9; k++) {
        a.rect(416 + k * 29, 48 + row * 55, 18, 25, k % 3 ? '#877b50' : '#62694e');
        a.rect(422 + k * 29, 51 + row * 55, 2, 19, '#b4a774');
        a.rect(416 + k * 29, 64 + row * 55, 18, 2, '#3e4939');
      }
    }
    a.wood(327, 20, 25, 249, 123); a.wood(0, 11, W, 18, 85);
    table(258, kind === 'edict');
  }
  function lamp(x, y, light = 1) {
    a.ellipse(x, y + 4, 22, 4, '#8d8057'); a.rect(x - 3, y - 35, 6, 35, '#65745b');
    a.ellipse(x, y - 36, 23, 5, '#a3915e'); a.ellipse(x, y - 38, 18, 2, '#343a2b');
    if (light > 0) {
      a.group(light, () => {
        a.poly([[x - 4, y - 39], [x - 7, y - 47], [x - 2, y - 57], [x + 4, y - 48], [x + 3, y - 39]], '#c99b52');
        a.rect(x - 2, y - 50, 3, 10, '#ecce83');
        a.rect(x - 17, y - 35, 32, 1, '#e0bd77');
      });
    }
  }
  function ship(x, y, s, t, fading = 1) {
    a.group(fading, () => {
      a.poly([[x - 78 * s, y - 19 * s], [x + 66 * s, y - 19 * s], [x + 88 * s, y - 29 * s], [x + 64 * s, y + 4 * s], [x - 54 * s, y + 6 * s]], '#283f42');
      a.line(x - 61 * s, y - 12 * s, x + 64 * s, y - 12 * s, '#8d8d68', Math.max(1, 2 * s));
      a.line(x, y - 91 * s, x, y - 13 * s, '#7d8068', Math.max(1, 3 * s));
      a.poly([[x - 37 * s, y - 85 * s], [x + 31 * s, y - 81 * s], [x + 41 * s, y - 37 * s], [x - 34 * s, y - 35 * s]], '#a4ac96');
      for (let i = 0; i < 6; i++) a.line(x - 34 * s, y - (80 - i * 8) * s, x + (33 + i) * s, y - (77 - i * 8) * s, '#748d83', Math.max(1, s));
      for (let i = 0; i < 5; i++) {
        const phase = t * 2.6 + i * .12, reach = Math.sin(phase) * 13;
        const xx = x + (i * 21 - 48) * s;
        a.ellipse(xx, y - 22 * s, 3 * s, 4 * s, '#273c3d');
        a.line(xx, y - 13 * s, xx + (12 + reach) * s, y + 17 * s, '#9f9d7a', Math.max(1, 2 * s));
        if (Math.cos(phase) < 0) a.rect(xx + (9 + reach) * s, y + 18 * s, 14 * s, s, '#a9b9ae');
      }
    });
  }
  function sea(t = 0) {
    a.sky('sea'); a.rect(0, 179, W, H - 179, '#355d6d');
    a.rect(0, 179, W, 16, '#829e9e'); a.rect(0, 195, W, 31, '#618790');
    for (let i = 0; i < 65; i++) {
      const y = 197 + hash(i, 57) * 184, drift = motion(t * .5 + i, reduced ? 1 : 4);
      a.rect(hash(i, 23) * W + drift, y, 6 + hash(i, 85) * 44, i % 9 ? 1 : 2, i % 3 ? '#537c85' : '#8ca49f');
    }
  }
  function curtain(t, gap = 330, touch = 0, late = false) {
    const center = late ? 384 : 437, half = gap / 2;
    const wave = motion(t * .7, reduced ? 1 : 4);
    for (const side of [-1, 1]) {
      const edge = center + side * half;
      const outer = side < 0 ? 0 : W;
      a.poly([[outer, 0], [center + side * 74, 0], [edge + side * 20, 100], [edge + wave + side * touch, 238], [edge + side * 40 + wave, 375], [outer, 420]], late ? '#322d29' : '#373d36');
      for (let i = 0; i < 6; i++) {
        const x = mix(outer, edge, i / 6);
        a.poly([[mix(outer, center + side * 74, i / 6), 0], [x + side * 10, 110], [x + wave, 236], [x + side * 26, 388], [x + side * 32, 386], [x + 7 + wave, 226]], i % 2 ? '#464539' : '#202b2a');
      }
      a.line(center + side * 75, 0, edge + side * 20, 100, '#af9660', 3);
      a.line(edge + side * 20, 100, edge + wave + side * touch, 238, '#af9660', 3);
      a.line(edge + wave + side * touch, 238, edge + side * 40 + wave, 375, '#af9660', 3);
    }
    a.wood(0, 0, W, 25, 49); a.wood(0, 366, W, 66, 93, true);
    a.rect(0, 366, W, 3, '#ae8c52');
  }
  function market(t, near = false) {
    a.sky('dawn'); a.ridge(198, 29, '#94a590', 17); a.rect(0, 232, W, 200, '#7c8464');
    a.poly([[361, 227], [414, 227], [644, 432], [124, 432]], '#c1b086');
    for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
      const w = 129 - row * 27, x = side < 0 ? 10 + row * 95 : 630 - row * 95;
      a.palace(x, 151 + row * 19, w, 95 - row * 21, row + 31);
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? 7 : 590;
      a.rect(x + 8, 233, 6, 115, '#594e34'); a.rect(x + 148, 233, 6, 115, '#594e34');
      a.poly([[x, 206], [x + 148, 207], [x + 170, 254], [x - 14, 254]], side < 0 ? '#8b6752' : '#637760');
      for (let i = 0; i < 8; i++) a.line(x + i * 20, 210, x - 9 + i * 24, 253, '#aaa07a');
      a.wood(x - 1, 319, 164, 10, side + 38, false);
      for (let j = 0; j < 5; j++) {
        a.ellipse(x + 18 + j * 28, 310, 11, 12, '#847657'); a.ellipse(x + 18 + j * 28, 300, 6, 2, '#363e30');
        a.rect(x + 14 + j * 28, 301, 2, 12, '#c5b280');
      }
    }
    a.texture(221, 258, 334, 151, 177, ['#a89971', '#d1c095', '#808666'], 91, true);
    for (let i = 0; i < 9; i++) {
      const s = .28 + i * .042, x = 295 + (i % 4) * 56 + motion(t * .25 + i, 9);
      a.figure(x, 251 + (i % 3) * 21, s, { variant: i, walk: t * 2.5 + i, load: i % 3 === 0 });
    }
    if (!near) {
      a.figure(248 + t * 6, 342, .94, { variant: 1, walk: t * 3.5, load: true });
      a.figure(527 - t * 4, 328, .78, { variant: 0, walk: t * 3 + 2 });
    }
    a.grass(690, 358, 1.5, 64); a.grass(103, 382, 1.5, 96);
  }

  const scenes = {
    latch(t) {
      const load = E(t, .5, 1.25), push = E(t, 1.25, 2.95), release = E(t, 3.5, 4.5);
      const slide = -45 + push * 45;
      threshold(1 - push, slide);
      // Dedicated close composition, not the same full gate with hands pasted on.
      a.wood(0, 0, 381, 275, 31); a.wood(389, 0, 379, 275, 32);
      a.rect(381, 0, 8, 278, '#0a1318'); a.rect(384, 0, 2, 272, '#998254');
      for (const x of [82, 257, 510, 685]) for (const y of [78, 218]) {
        a.rect(x - 15, y - 16, 31, 32, '#3f4635'); a.stud(x, y, 12);
        a.rect(x - 16, y - 19, 32, 2, '#83764c');
      }
      // Pause -> grip -> compression -> displacement -> settle, without camera shake.
      a.hand(291 + slide, 326 + (1 - load) * 13 + release * 12, 1.38, 1, load > .5 ? 'grip' : 'reach');
      a.hand(477 + slide, 326 + (1 - load) * 13 + release * 12, 1.38, -1, load > .5 ? 'grip' : 'reach');
      a.rect(244 + slide, 290, 35, 3, '#c29c67');
      dust(t - 2.95, 569, 281, 14, .5);
    },
    seam(t) {
      threshold(1, 0, true);
      a.group(.25, () => a.rect(0, 0, W, H, '#07131b'));
      a.rect(384, 38, 2, 284, '#dac084'); a.rect(385, 163, 1, 34, '#f0d99c');
      for (let i = 0; i < 9; i++) {
        const y = 65 + ((i * 29 + t * 3) % 209);
        a.rect(378 + hash(i, 31) * 19, y, 1, 1, '#a0936d');
      }
      // The beam rests. Only dust crosses that narrow shaft of light.
    },
    'small-hands'(t) {
      court(false); a.group(.21, () => a.rect(0, 0, W, 304, '#1b2b36'));
      rail(307);
      const grip = E(t, .5, 1.6), settle = Math.sin(Math.PI * E(t, 1.6, 2.4)) * 2;
      a.hand(280 + grip * 4, 328 + settle, .76, 1, 'grip', true);
      a.hand(476 - grip * 4, 328 + settle, .76, -1, 'grip', true);
      // Oversized armrest ends give the smaller hands a readable scale reference.
      a.stud(225, 319, 12); a.stud(543, 319, 12);
    },
    court(t) {
      court(false);
      const reveal = E(t, 0, 2.3);
      rail(324 + (reduced ? 0 : reveal * 77));
      if (reveal < .8) {
        a.hand(279, 336 + reveal * 76, .76, 1, 'grip', true);
        a.hand(476, 336 + reveal * 76, .76, -1, 'grip', true);
      }
      a.banner(100, 62, 168, t * .6, 1); a.banner(667, 62, 168, t * .6, 2);
    },
    drums(t) {
      studio(); table(242);
      a.poly([[123, 167], [616, 167], [692, 322], [73, 322]], '#292f28');
      a.poly([[132, 174], [608, 174], [674, 310], [90, 310]], '#b19b6e');
      // Schematic sand terrain, intentionally no modern borders or exact map claims.
      for (let i = 0; i < 8; i++) {
        const x = 150 + hash(i, 79) * 430, y = 203 + hash(i, 83) * 67;
        a.poly([[x - 24, y + 12], [x - 13, y - 1], [x - 5, y - 1], [x - 5, y - 10], [x + 3, y - 10], [x + 18, y + 12]], '#837d57');
        a.line(x - 12, y + 1, x + 8, y + 8, '#d0b886');
      }
      for (let i = 0; i < 22; i++) a.rect(175 + i * 15, 260 + Math.sin(i * .45) * 18, 19, 3, '#697e72');
      for (let i = 0; i < 6; i++) {
        const p = E(t, .55 + i * .35, 1.0 + i * .35), x = 191 + i * 74, y = 229 + Math.sin(i) * 17;
        a.rect(x - 13, y + 3, 31, 6, '#70674a');
        a.rect(x - 10, y - p * 39, 25, 6 + p * 37, '#733e32');
        a.rect(x - 7, y - p * 37, 3, p * 34, '#d1a366');
        if (p > .7) a.glyph(x - 3, y - p * 29, .8, i, '#c0a371');
      }
      a.hand(173, 336 - E(t, 0, .65) * 10, .94, 1, 'reach');
      a.hand(610, 338 - E(t, 0, .65) * 10, .94, -1, 'reach');
    },
    banners(t) {
      a.landscape('dusk'); a.rect(0, 281, W, 151, '#68694e');
      // Distant ranks establish army scale before the nearer, fully articulated march.
      for (let row = 0; row < 4; row++) for (let i = 0; i < 38; i++) {
        const s = .15 + row * .019, x = ((i * 22 + t * (3 + row)) % 842) - 35;
        a.figure(x, 218 + row * 11, s, { role: 'soldier', variant: i * 7 + row * 3, walk: t * 4.5 + i * .45 });
      }
      for (let row = 0; row < 3; row++) for (let i = 0; i < 13; i++) {
        const s = .33 + row * .15, x = ((i * 65 + t * (11 + row * 3)) % 890) - 55;
        a.figure(x, 247 + row * 35, s, { role: 'soldier', variant: i + row, walk: t * 4.5 + i * .45 });
        if (i % 3 === 0) a.banner(x - 17, 130 + row * 17, 107 + row * 13, t, i);
      }
      const move = reduced ? 0 : t * 8;
      a.horse(379 + move, 351, .95, t * 5); a.horse(496 + move, 355, 1, t * 5 + 1.5);
      a.line(375 + move, 311, 217 + move, 298, '#aa9160', 3);
      a.wood(142 + move, 271, 114, 53, 111, false); a.rect(145 + move, 266, 111, 5, '#b59864');
      a.figure(198 + move, 292, .78, { role: 'soldier', variant: 2 });
      a.wheel(165 + move, 341, 28, t * 1.8); a.wheel(249 + move, 341, 28, t * 1.8);
      a.banner(71, 76, 247, t, 3);
      a.texture(0, 365, W, 65, 61, ['#a38d60', '#4e5945'], 70, true);
    },
    'six-gates'(t) {
      a.landscape('dawn');
      a.poly([[375, 172], [395, 172], [582, 432], [181, 432]], '#baaa83');
      // Nested physical gateways: each pair opens on its own hinge-like pixel profile.
      for (let i = 5; i >= 0; i--) {
        const w = 670 - i * 102, top = 36 + i * 26, bottom = 386 - i * 31;
        const left = 384 - w / 2, right = 384 + w / 2;
        const p = E(t, .2 + i * .97, 1.05 + i * .97), leaf = (w / 2 - 15) * (1 - p);
        a.rect(left - 12, top, 18, bottom - top, i % 2 ? '#596151' : '#454f47');
        a.rect(right - 6, top, 18, bottom - top, i % 2 ? '#596151' : '#454f47');
        a.rect(left - 17, top - 6, w + 34, 14, '#263b3c'); a.rect(left - 10, top + 8, w + 20, 3, '#a58f62');
        if (leaf > 1) {
          a.wood(left + 6, top + 12, leaf, bottom - top - 12, i + 41);
          a.wood(right - leaf - 6, top + 12, leaf, bottom - top - 12, i + 41);
          a.line(left + leaf + 4, top + 16, left + leaf + 4, bottom, '#a08651', 2);
          a.line(right - leaf - 6, top + 16, right - leaf - 6, bottom, '#a08651', 2);
          for (let n = 0; n < 3; n++) {
            a.stud(left + leaf * .6, top + 32 + n * (bottom - top) / 4, Math.max(2, 5 - i / 2));
            a.stud(right - leaf * .6, top + 32 + n * (bottom - top) / 4, Math.max(2, 5 - i / 2));
          }
        }
      }
    },
    stairs(t) {
      a.sky('cold'); a.palace(164, 43, 440, 146, 38);
      a.rect(0, 215, W, 217, '#505f55');
      const ascent = reduced ? 0 : E(t, 0, 4.5) * 48;
      for (let i = 0; i < 10; i++) {
        const y = 211 + i * i * 3.1 + ascent, w = 104 + i * 63;
        a.rect(384 - w / 2, y, w, 5 + i * 1.5, '#b1ac8d');
        a.rect(384 - w / 2, y + 5 + i * 1.5, w, 5 + i * .9, '#6b7668');
        a.texture(384 - w / 2, y + 1, w, 4, i + 23, ['#92987e'], 8, true);
      }
      for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
        const withdraw = E(t, .3 + row * .45, 1.4 + row * .45) * 13;
        const x = 384 + side * (137 + row * 70 + withdraw);
        a.figure(x, 255 + row * 48, .66 + row * .22, { role: 'official', variant: row, bow: E(t, .4, 2) });
        a.line(x + side * 21, 183 + row * 10, x + side * 21, 274 + row * 39, '#a19d76', 3);
      }
      a.hand(145, 340 + Math.sin(t * 3.2) * 2, .95, 1, 'rest');
    },
    seal(t) {
      palaceSea();
      const retract = E(t, 2.3, 5.8), deskY = 269 + (reduced ? retract * 13 : retract * 125);
      table(deskY, true);
      if (retract < .95) {
        a.bamboo(289, deskY + 5, 185, 86, 1, .75);
        const press = E(t, .35, 1.5), rebound = Math.sin(Math.PI * E(t, 1.5, 1.9)) * 3;
        const y = deskY + 3 + 17 * press - rebound;
        a.rect(344, y - 28, 79, 38, '#34584b'); a.rect(348, y - 27, 10, 34, '#77937a');
        a.poly([[363, y - 28], [365, y - 43], [380, y - 51], [397, y - 41], [400, y - 28]], '#5f7b61');
        a.rect(343, y + 9, 81, 7, '#a55a3f'); a.rect(349, y + 11, 69, 2, '#d7a46c');
        a.hand(313, deskY + 43 + press * 2, .9, 1, 'grip');
        a.hand(455, deskY + 43 + press * 2, .9, -1, 'grip');
        if (t > 1.5 && t < 2) a.group((1 - E(t, 1.5, 2)) * .4, () => a.rect(340, y + 17, 91, 3, '#e1b175'));
      }
      a.banner(55, 83, 215, t * .3, 1); a.banner(714, 83, 215, t * .3, 0);
    },
    bamboo(t) {
      studio(); lamp(662, 259);
      const spread = E(t, .1, 1.55), write = E(t, 2, 4.2);
      a.bamboo(239, 231, 306, 110, .08 + spread * .92, .08);
      a.hand(255 + spread * 263, 331, .84, -1, 'reach');
      const bx = 323 + Math.min(1, write * 2) * 26, by = 296 + Math.max(0, write - .5) * 29;
      a.line(bx + 29, by - 40, bx, by + 9, '#a98b51', 4);
      a.line(bx + 30, by - 40, bx + 2, by + 6, '#d7b776');
      a.poly([[bx - 2, by + 5], [bx + 4, by + 8], [bx - 4, by + 16]], '#1b2825');
      a.hand(bx + 21, 324 + Math.max(0, write - .5) * 16, .92, -1, 'write');
      if (write > 0) {
        a.line(320, 311, 320 + 26 * Math.min(1, write * 2), 311, '#394032', 2);
        if (write > .5) a.line(346, 311, 346, 311 + (write - .5) * 29, '#394032', 2);
      }
      a.ellipse(586, 317, 29, 12, '#26332e'); a.ellipse(586, 313, 24, 7, '#121e20');
    },
    'one-script'(t) {
      studio();
      // Separate slips slide into a bound document rather than floating neon symbols.
      const gather = E(t, .35, 2.65), offer = E(t, 3.5, 5.8);
      for (let i = 0; i < 8; i++) {
        const x = mix(126 + i * 69, 310 + i * 18, gather), y = mix(225 + (i % 3) * 21, 240, gather) - offer * 32;
        a.bamboo(x, y, 17, 83, 1, 0);
        a.glyph(x + 4, y + 18, .68, gather < .85 ? i : 1);
        a.glyph(x + 4, y + 45, .68, gather < .85 ? i + 2 : 2);
      }
      if (gather > .7) {
        a.line(309, 248 - offer * 32, 455, 248 - offer * 32, '#495641', 2);
        a.line(309, 312 - offer * 32, 455, 312 - offer * 32, '#495641', 2);
      }
      a.hand(305 + gather * 23, 342 - offer * 25, .86, 1, 'grip');
      a.hand(471 - gather * 21, 342 - offer * 25, .86, -1, 'grip');
      if (offer > .25) {
        // Receiving hand enters across the desk; narrator hands remain in the foreground.
        a.group(E(t, 4, 4.7), () => a.hand(491, 261 - offer * 13, .6, -1, 'reach', false, true));
      }
    },
    balance(t) {
      studio(); table(340);
      const add = E(t, .45, 2), settle = Math.max(0, t - 2);
      const tilt = t < 2 ? -18 : -18 * Math.exp(-settle * 1.9) * Math.cos(settle * 5);
      a.rect(376, 154, 15, 178, '#526a54'); a.rect(379, 157, 3, 171, '#c1a66a');
      a.ellipse(384, 336, 48, 8, '#69785b'); a.rect(349, 329, 70, 6, '#9f9560');
      a.line(239, 171 - tilt, 529, 171 + tilt, '#a69c6a', 5); a.stud(384, 173, 7);
      for (const side of [-1, 1]) {
        const x = 384 + side * 145, yy = 303 + side * tilt;
        a.line(x, 174 + side * tilt, x - 44, yy, '#b5ac79');
        a.line(x, 174 + side * tilt, x + 44, yy, '#b5ac79');
        a.poly([[x - 46, yy], [x + 46, yy], [x + 30, yy + 13], [x - 30, yy + 13]], '#697d60');
        a.line(x - 44, yy, x + 44, yy, '#d1bb7d', 2);
        if (side < 0) { a.poly([[x - 25, yy - 7], [x - 18, yy - 25], [x + 13, yy - 28], [x + 27, yy - 7]], '#ad9b69'); a.texture(x - 17, yy - 21, 34, 17, 9, ['#d0b880'], 12); }
        else {
          // Enter from beside and above the empty dish; never pass through it.
          const wx = x + (1 - add) * 69, wy = yy - 26 - (1 - add) * 12;
          a.rect(wx - 16, wy, 32, 25, '#7d8a65'); a.rect(wx - 13, wy + 2, 5, 20, '#b2a56c');
          a.ellipse(wx, wy - 3, 8, 6, '#809267'); a.rect(wx - 3, wy - 6, 7, 5, '#293c32');
          if (t < 2.9) {
            const withdraw = E(t, 2.08, 2.9);
            a.group(1 - withdraw, () => a.hand(wx + 19 + withdraw * 43, wy + 54, .83, -1, 'grip'));
          }
        }
      }
    },
    coins(t) {
      studio();
      a.poly([[433, 252], [704, 208], [746, 241], [453, 287]], '#756b4c');
      a.line(453, 288, 741, 245, '#baa274', 3);
      for (let i = 0; i < 5; i++) {
        const x = 447 + i * 49;
        a.rect(x, 236 - i * 8, 34, 32, '#5b725b'); a.rect(x + 3, 239 - i * 8, 4, 23, '#b6a36b');
        a.ellipse(x + 17, 233 - i * 8, 7, 5, '#89986f');
      }
      for (let i = 0; i < 9; i++) {
        const start = .2 + i * .27, flight = clamp((t - start) / .8), impact = start + .8;
        if (t < start) continue;
        const x = 235 + i * 22 + 7 * Math.sin(i * 3), end = 318 - (i % 3) * 11;
        const bounce = t > impact ? Math.max(0, 1 - (t - impact) / .45) * Math.abs(Math.sin((t - impact) * 15)) * 9 : 0;
        a.coin(x, mix(218, end, flight * flight) - bounce, 20 + (i % 3), i);
      }
      a.coin(137, 285, 40, 2); a.coin(173, 326, 30, 3);
      a.hand(454 + E(t, 1, 3) * 72, 339, .95, -1, 'reach');
      a.wood(78, 358, 411, 15, 219, false);
      for (let i = 0; i < 24; i++) a.rect(91 + i * 16, 359, 1, i % 4 === 0 ? 10 : 5, '#d1b77d');
    },
    tracks(t) {
      a.landscape('dawn');
      a.poly([[373, 171], [395, 171], [698, 432], [69, 432]], '#b8a57c');
      for (const side of [-1, 1]) {
        a.poly([[384 + side * 5, 183], [384 + side * 8, 183], [384 + side * 151, 432], [384 + side * 135, 432]], '#776e52');
        a.line(384 + side * 9, 184, 384 + side * 153, 432, '#d0b98a', 2);
        for (let i = 0; i < 9; i++) {
          const f = ((i / 9 + t * (reduced ? .025 : .06)) % 1), yy = 192 + f * f * 243;
          a.rect(384 + side * (5 + f * f * 137) - 2, yy, 5 + f * 9, 1 + f * 2, '#4f624e');
        }
        for (let i = 0; i < 8; i++) {
          const f = i / 8;
          a.grass(384 + side * (33 + f * f * 324), 219 + f * f * 148, .3 + f, i + 62, motion(t, 1));
        }
      }
      a.wood(0, 361, W, 71, 72, true); a.rect(0, 362, W, 4, '#b79b63');
      a.hand(192, 338, .91, 1, 'grip'); a.hand(576, 338, .91, -1, 'grip');
      a.line(206, 307, 301, 207, '#b5ac83', 2); a.line(564, 307, 464, 207, '#b5ac83', 2);
    },
    crossing(t) {
      a.landscape('dawn');
      a.poly([[0, 232], [219, 237], [W, 356], [W, H], [441, H]], '#4d7a7a');
      for (let i = 0; i < 24; i++) a.rect(10 + hash(i, 44) * W, 297 + hash(i, 62) * 102, 14 + hash(i, 22) * 45, 2, '#8ea69a');
      // Timber deck and posts, not a later ornamental stone arch bridge.
      a.poly([[83, 284], [621, 221], [711, 276], [160, 366]], '#81775c');
      for (let i = 0; i < 16; i++) {
        const x = 98 + i * 35, y = 283 - i * 4;
        a.line(x, y, x + 66, y + 66, '#b4a17a', 3);
      }
      for (let i = 0; i < 9; i++) {
        const x = 120 + i * 67, y = 291 - i * 8;
        a.wood(x, y, 9, 75, i + 19, false); a.wood(x + 62, y + 52, 9, 58, i + 39, false);
      }
      a.line(117, 286, 675, 221, '#c0ac7d', 5); a.line(175, 349, 720, 270, '#bca375', 5);
      for (let i = 0; i < 4; i++) {
        const x = 203 + i * 57 + t * 7, y = 300 - (x - 203) * .12;
        a.figure(x, y, .63, { variant: i, walk: t * 3 + i, load: true });
      }
      const hx = 638 - t * 24, hy = 296 - (hx - 400) * .12;
      a.horse(hx, hy, .7, t * 5);
      a.figure(hx - 5, hy - 32, .52, { variant: 0, role: 'soldier' });
      a.bamboo(hx - 21, hy - 76, 17, 23, 1, 0);
      a.grass(50, 356, 2.8, 7); a.grass(74, 372, 1.8, 11);
    },
    rampart(t) {
      a.sky('dusk');
      a.ridge(216, 88, '#8e8770', 8); a.ridge(300, 88, '#706f55', 4); a.ridge(381, 83, '#4d5c47', 11);
      const points = [[57, 337], [178, 306], [135, 273], [318, 247], [283, 224], [455, 208], [523, 177], [626, 164], [656, 143]];
      // Wide, winding rammed-earth ribbon. Horizontal strata, no brick merlons/towers.
      for (let i = points.length - 2; i >= 0; i--) {
        const p = points[i], q = points[i + 1], thick = 25 - i * 2.4;
        a.poly([[p[0], p[1]], [q[0], q[1]], [q[0], q[1] + thick], [p[0], p[1] + thick + 7]], '#8c7854');
        for (let row = 0; row < 4; row++) a.line(p[0], p[1] + row * thick / 4 + 4, q[0], q[1] + row * thick / 4 + 4, row % 2 ? '#b09c6c' : '#6f684a', 2);
        a.poly([[p[0] - 7, p[1] - 5], [q[0] - 3, q[1] - 4], [q[0] + 7, q[1]], [p[0] + 15, p[1] + 3]], '#c0a777');
      }
      for (let i = 0; i < 6; i++) {
        const x = 105 + i * 20, y = 333 - i * 5;
        a.figure(x, y, .27, { variant: i, walk: t * 1.7 + i, load: true });
      }
      a.grass(652, 369, 2, 47); a.grass(698, 381, 2.3, 46);
      a.poly([[0, 368], [176, 344], [261, 376], [237, 432], [0, 432]], '#726347');
      a.texture(6, 379, 213, 44, 357, ['#a28a5e', '#504f3c'], 70);
    },
    shoulders(t) {
      a.sky('dusk'); a.ridge(265, 56, '#706852', 31);
      a.rect(0, 260, W, 172, '#796345');
      for (let i = 0; i < 8; i++) { a.rect(0, 268 + i * 17, W, 3, '#a28c61'); a.texture(0, 272 + i * 17, W, 9, i + 7, ['#665b42', '#b59b6a'], 34); }
      for (let k = 0; k < 3; k++) {
        const x = 175 + k * 204, phase = (t + .42 + k * .04) % 2;
        const lift = E(phase, .25, 1.1), strike = E(phase, 1.14, 1.42), raised = lift * (1 - strike);
        const bend = (1 - raised) * 14, y = 306 - raised * 55;
        // Weight transfers into bent knees and dropped shoulders at impact.
        a.poly([[x - 30, 285], [x - 5, 288], [x - 24 - bend / 2, 341], [x - 45 - bend / 2, 341]], '#353f34');
        a.poly([[x + 4, 283], [x + 28, 285], [x + 38 + bend, 342], [x + 13 + bend, 342]], '#444b3a');
        a.rect(x - 51 - bend / 2, 340, 28, 8, '#27332d'); a.rect(x + 9 + bend, 341, 31, 7, '#27332d');
        a.poly([[x - 31, 206 + bend], [x + 22, 201 + bend], [x + 35, 281], [x - 29, 290]], k % 2 ? '#8e7956' : '#697259');
        a.line(x - 25, 225 + bend, x + 14, 236 + bend, '#bd9f72', 3);
        a.face(x - 7 + bend / 2, 186 + bend, .82, false, k + 1);
        // Both bare forearms connect shoulders to hands on a real cross-grip.
        for (const side of [-1, 1]) {
          a.poly([[x + side * 27, 216 + bend], [x + side * 40, 226 + bend], [x + side * 30, y - 32], [x + side * 17, y - 32]], '#aa8860');
          a.line(x + side * 30, 222 + bend, x + side * 23, y - 29, '#cfac78', 3);
        }
        a.wood(x - 10, y - 67, 20, 75, k + 146, false); a.wood(x - 39, y - 35, 78, 9, k + 148, false);
        for (const side of [-1, 1]) {
          a.rect(x + side * 23 - 7, y - 37, 14, 13, '#b49267');
          for (let j = 0; j < 3; j++) a.rect(x + side * 23 - 5 + j * 4, y - 35, 1, 8, '#6d5943');
        }
        a.poly([[x - 25, y + 1], [x + 25, y + 1], [x + 29, y + 26], [x - 29, y + 26]], '#514d3c');
        a.rect(x - 24, y + 4, 48, 3, '#a58e63');
        dust(phase - 1.42, x, 333, k + 26, .8);
      }
    },
    decree(t) {
      studio('edict');
      const extinguish = 1 - E(t, 2.2, 3.1);
      lamp(589, 255, extinguish); lamp(656, 252, 1 - E(t, 2.8, 3.8));
      a.group((1 - extinguish) * .44, () => a.rect(0, 28, W, 230, '#101d22'));
      a.bamboo(254, 237, 255, 99, 1, .93);
      a.rect(438, 287, 29, 26, '#8c4838'); a.glyph(446, 291, .65, 3, '#c39466');
      a.hand(243, 333, .88, 1, 'grip'); a.hand(522, 333, .88, -1, 'grip');
      if (t > 3.1) a.group((1 - E(t, 3.1, 5.5)) * .4, () => {
        a.rect(588, 191 - (t - 3.1) * 8, 2, 9, '#8d9a8f');
        a.rect(590, 182 - (t - 3.1) * 8, 6, 2, '#8d9a8f');
      });
    },
    'empty-court'(t) {
      court(true); rail(364);
      a.banner(101, 71, 154, 0, 1); a.banner(668, 71, 154, 0, 0);
      // No restless motion here: an offered hand finds no answering gesture.
      const offer = E(t, .45, 2.2), retreat = E(t, 4.1, 6.5);
      a.hand(458, 353 - offer * 22 + retreat * 17, .85, -1, 'reach');
    },
    shore(t) {
      sea(t);
      a.poly([[0, 290], [91, 258], [166, 271], [227, 317], [266, 337], [235, 432], [0, 432]], '#334f4c');
      a.poly([[11, 319], [90, 282], [133, 294], [169, 284], [210, 317], [153, 332]], '#607767');
      ship(555, 214, .25, t);
      const part = E(t, .3, 2.2), gap = 120 + part * 365;
      curtain(t, gap, part * 8);
      a.hand(494 + part * 191, 332, .92, -1, 'grip');
      a.grass(46, 351, 1.6, 58);
    },
    ships(t) {
      sea(t);
      const journey = E(t, .2, 6.5), scale = reduced ? .92 : mix(1.1, .65, journey);
      ship(373 + (reduced ? 0 : journey * 70), 292 - journey * 40, scale, t, 1 - journey * .75);
      ship(186 + journey * 36, 227 - journey * 12, .43, t + 1, 1 - journey * .8);
      for (let i = 0; i < 6; i++) a.group(.07 + journey * .1, () => a.rect(0, 177 + i * 19, W, 8 + i * 2, '#a1b5ae'));
      a.rect(0, 388, W, 44, '#254653');
    },
    kiln(t) {
      studio('kiln');
      // Warm kiln throat, restricted to the right background, never a screen flash.
      a.poly([[532, 253], [532, 105], [556, 77], [657, 77], [688, 113], [688, 253]], '#70503a');
      a.poly([[550, 253], [550, 124], [571, 105], [647, 105], [669, 127], [669, 253]], '#1f2421');
      a.rect(556, 218, 106, 29, '#8d4f33'); a.rect(572, 236, 76, 8, '#bf7b46');
      for (let i = 0; i < 8; i++) a.rect(562 + i * 13, 224 + Math.sin(t * .9 + i) * 2, 7, 4, '#d09b59');
      a.poly([[286, 157], [345, 155], [386, 173], [415, 204], [430, 267], [413, 338], [241, 338], [226, 276], [239, 205], [261, 174]], '#775841');
      a.poly([[290, 163], [343, 162], [378, 180], [397, 217], [409, 291], [397, 334], [253, 334], [244, 273], [256, 210], [270, 182]], '#a9825e');
      a.poly([[279, 165], [320, 184], [348, 160], [356, 170], [324, 197], [273, 177]], '#c09a71');
      a.face(321, 127, 1.28, true, 1);
      a.texture(269, 186, 102, 18, 345, ['#957451', '#bd956c'], 23);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
        const x = 258 + col * 21 + (row % 2) * 3, y = 213 + row * 21;
        a.rect(x, y, 18, 18, '#81654d'); a.rect(x + 2, y + 1, 14, 14, '#b28c66');
        a.rect(x + 3, y + 3, 2, 2, '#dfb585'); a.rect(x + 11, y + 3, 2, 2, '#5f503e');
      }
      const carve = E(t, 1, 3.8), join = E(t, 0, .8);
      // The clay forearms are modelled separately from the artisan's living hands.
      a.poly([[243, 232], [261, 238], [277, 270], [315, 270], [321, 291], [269, 293], [249, 281]], '#87694e');
      a.poly([[399, 230], [384, 240], [374, 268], [335 - join * 10, 270], [325 - join * 8, 290], [382, 291], [402, 267]], '#bd966d');
      a.rect(304, 269, 22, 22, '#b48d65'); a.rect(327 - join * 9, 272, 20, 19, '#977550');
      for (let j = 0; j < 4; j++) a.line(306 + j * 4, 276, 306 + j * 4, 285, '#745b44');
      // Supporting palm and carving fingers belong to the craftsperson, not an emperor body.
      a.hand(234 + join * 12, 329, .87, 1, 'grip', false, true);
      a.hand(460 - carve * 25, 331, .9, -1, 'write', false, true);
      a.line(427 - carve * 22, 307, 381 - carve * 6, 282 + carve * 14, '#473e31', 3);
      a.line(382, 282, 382, 282 + carve * 16, '#503f32', 2);
      for (let i = 0; i < 5; i++) if (carve > i / 6) a.rect(381 + i * 4, 311 + i * 3, 3, 2, '#c29a6e');
      a.bamboo(63, 302, 85, 50, 1, 0);
    },
    'silent-host'(t) {
      a.rect(0, 0, W, H, '#1a292b');
      for (let i = 0; i < 7; i++) {
        a.poly([[i * 133 - 40, 0], [i * 133 + 38, 0], [i * 133 + 125, 432], [i * 133 - 78, 432]], i % 2 ? '#343c33' : '#2a362f');
        a.line(i * 133 + 8, 27, i * 133 + 68, 400, '#4b5040', 2);
      }
      const pull = E(t, .8, 5.4), spread = reduced ? 1 : pull;
      // Every soldier has its own knot, face, sleeve/arm pose and plate colour.
      for (let row = 0; row < 7; row++) {
        const s = .26 + row * .105, foot = 138 + row * 33;
        for (let col = 0; col < 13; col++) {
          const x = 45 + col * 56 + (row % 2) * 13;
          if (row === 6 && col === 6) continue;
          a.figure(x, foot, s, { role: 'clay', variant: col + row * 3 });
        }
      }
      // Keep this same complete figure all the way into its front-rank place.
      // No threshold swaps a giant portrait for a different small sprite.
      const faceScale = mix(4, .3026, spread), bodyScale = faceScale / .34;
      const headY = mix(193, 267.47, spread);
      a.figure(381, headY + 77 * bodyScale, bodyScale, { role: 'clay', variant: 2 });
      a.rect(0, 408, W, 24, '#172628');
    },
    carriage(t) {
      a.landscape('dusk'); a.poly([[303, 206], [394, 206], [652, 432], [139, 432]], '#958468');
      for (let i = 0; i < 8; i++) {
        const x = 130 + i * 73;
        a.line(x, 203, x - 27, 265 + i * 9, '#59664e', 3);
      }
      curtain(t, 263 + motion(t * .75, reduced ? 2 : 12), 0, true);
      a.hand(491 + motion(t * .75, reduced ? 1 : 4), 331, .92, -1, 'grip');
      a.rect(354, 75, 23, 3, '#dac090');
    },
    'falling-hand'(t) {
      a.landscape('dusk');
      const fall = E(t, .4, 4.5), gap = mix(252, 15, E(t, 1, 5.7));
      curtain(6, gap, 0, true);
      const y = 331 + fall * 30, x = 491 - fall * 22;
      a.hand(x, y, .9, -1, fall < .4 ? 'grip' : 'drop');
      a.group(E(t, 4.4, 6) * .67, () => a.rect(0, 0, W, H, '#0d171c'));
    },
    absence(t) {
      threshold(0, 0, true);
      // No apparition, body or silhouette: the unheld latch outlives its owner.
      a.rect(385, 44, 1, 227, '#6b7862');
      a.group(.15, () => a.rect(0, 0, W, H, '#0b1b24'));
      a.rect(414 + t * 1.5, 301, 2, 1, '#9a9270');
    },
    erosion(t) {
      a.landscape('dawn'); floor(275, true);
      const wear = E(t, 1.7, 7.7), season = E(t, .3, 3.2);
      a.palace(173, 97, 422, 161, 3, true);
      // Repaint eroded pieces with the same original landscape, clipped to many
      // uneven strips. Architecture is removed, never merely dimmed into a ghost.
      ctx.save();
      try {
        ctx.beginPath();
        for (let col = 0; col < 66; col++) {
          // Start ABOVE the roof on every strip, otherwise roof fragments float.
          const x = 121 + col * 8, top = 75;
          const height = clamp((wear - hash(col, 53) * .13) / .87) * 235;
          if (height > 0) ctx.rect(x, Math.round(top), 8, Math.round(height));
        }
        ctx.clip(); a.landscape('dawn');
      } finally { ctx.restore(); }
      if (wear > .85) a.group(E(wear, .85, 1), () => { a.landscape('dawn'); a.rect(0, 306, W, 126, '#597353'); });
      a.poly([[234, 301], [293, 285], [405, 289], [476, 301], [452, 318], [262, 322]], '#878970');
      for (let i = 0; i < 27; i++) {
        const x = 25 + hash(i, 188) * 720, y = 316 + hash(i, 191) * 91;
        a.grass(x, y, (.2 + wear * 1.5) * (.5 + hash(i, 9)), i + 64, motion(t, 1));
      }
      // A few ochre leaves give way to green shoots: a seasonal passage, not snow FX.
      if (season < 1) a.group(1 - season, () => {
        for (let i = 0; i < 13; i++) a.rect(123 + hash(i, 6) * 520 + t * 7, 83 + hash(i, 7) * 192 + t * 6, 4, 2, '#c09c57');
      });
    },
    market(t) { market(t); },
    child(t) {
      market(t, true);
      const offer = E(t, .65, 3.3), accept = E(t, 3.4, 5.7);
      // Street-level observer, explicitly an imagined afterlife viewpoint, no emperor.
      a.figure(307, 357, 1.39, { variant: 0, noArms: true });
      a.figure(459, 357, 1.03, { variant: 2, role: 'child', noArms: true });
      // Close enough to read a real transfer: adult's two arms, child's two reaching arms.
      const bx = mix(350, 388, offer), by = 285 + accept * 7, release = E(t, 5.1, 6.5);
      const support = mix(bx - 7, 329, release);
      a.poly([[322, 271], [336, 281], [333, 299], [support, by + 10], [support, by + 20], [321, 311], [313, 294]], '#5d6e57');
      a.poly([[291, 272], [302, 280], [309, 307], [support + 9, by + 21], [support + 9, by + 31], [299, 321], [289, 304]], '#65765c');
      a.line(325, 281, 326, 298, '#92977b', 2);
      a.bamboo(bx - 13, by - 15, 51, 43, 1, 1);
      a.ellipse(support + 7, by + 28, 9, 5, '#c3a079');
      const reach = E(t, 2, 4.4);
      a.poly([[448, 294], [458, 302], [444, 318], [mix(442, bx + 36, reach), by + 14], [mix(438, bx + 28, reach), by + 20], [434, 326], [436, 311]], '#839294');
      a.poly([[471, 294], [480, 304], [466, 329], [mix(447, bx + 29, reach), by + 27], [mix(441, bx + 23, reach), by + 33], [459, 338], [473, 317]], '#657c80');
      a.ellipse(mix(442, bx + 33, reach), by + 20, 6, 4, '#d0ae83');
      a.ellipse(mix(445, bx + 26, reach), by + 31, 6, 4, '#c6a77f');
      // Recipient's gaze lowers towards the booklet; no modern uniforms or paper desk.
      a.face(458 - accept * 3, 277 + accept * 3, .42, false, 1, true);
      a.grass(573, 376, 1.4, 104);
    },
    'open-door'(t) {
      a.landscape('dawn');
      a.poly([[368, 211], [399, 211], [544, 432], [211, 432]], '#d0bc8d');
      a.palace(482, 180, 99, 35, 62, true); a.palace(176, 204, 91, 35, 41, true);
      const step = E(t, .4, 5.5), p = E(t, 0, 2.6);
      for (let i = 0; i < 3; i++) {
        const s = mix(i === 1 ? .54 : .85, i === 1 ? .37 : .58, step);
        a.figure(352 + i * 36 + step * (i - 1) * -8, 339 - step * 41 + (i % 2) * 6, s,
          { variant: i, role: i === 1 ? 'child' : 'citizen', walk: t * 2.8 + i, load: i === 0, back: true });
      }
      a.grass(231, 351, 1.6, 82); a.grass(555, 358, 1.5, 86);
      a.gate(.08 + .92 * p, 0, 0, true);
      if (t >= 2) a.group(E(t, 2, 3.4), () => {
        a.text('门外', 384, 48, 39, '#f0ddb0');
        a.text('秦始皇 · 第一人称文学独白', 384, 98, 13, '#d3d4b7');
      });
    }
  };

  const ids = Object.keys(scenes);
  shots.forEach((s, i) => {
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end <= s.start || (i ? s.start !== shots[i - 1].end : s.start !== 0))
      throw new Error('Invalid Qin shot timing');
    if (!ids.includes(s.id) || !chapters.some(c => c.id === s.chapter && s.start >= c.start && s.end <= c.end))
      throw new Error(`Unsupported Qin shot: ${s.id}`);
  });
  if (shots[shots.length - 1].end !== 180 || new Set(shots.map(s => s.id)).size !== 30)
    throw new Error('Incomplete Qin timeline');

  function poster() {
    // Quiet closed-gate composition; left third is intentionally low-contrast.
    // No title, dead hand, open gate, grass reclamation or ending information.
    a.rect(0, 0, W, H, '#101b21');
    a.wood(284, 28, 456, 365, 33);
    a.rect(594, 30, 2, 358, '#d3be87'); a.rect(591, 33, 1, 350, '#626f55');
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) a.stud(340 + col * 96, 86 + row * 70, 7);
    a.wood(287, 272, 447, 33, 112, false);
    for (const x of [405, 639]) { a.rect(x, 265, 22, 47, '#5b6046'); a.rect(x + 2, 268, 4, 40, '#b29f65'); }
    a.wood(270, 0, 24, H, 176); a.wood(285, 9, 483, 20, 35);
    a.rect(0, 396, W, 36, '#162429');
    for (let i = 0; i < 7; i++) a.rect(584 + hash(i, 33) * 18, 128 + i * 26, 1, 1, '#b0a578');
    a.group(.35, () => a.rect(0, 0, 269, H, '#0c1820'));
  }
  function draw(t, { reduced: reduce = false, poster: cover = false } = {}) {
    if (!Number.isFinite(t)) throw new TypeError('draw(t) requires a finite number');
    t = clamp(t, 0, 180); reduced = !!reduce;
    const shot = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
      ctx.shadowBlur = 0; ctx.filter = 'none';
      ctx.clearRect(0, 0, W, H); a.rect(0, 0, W, H, C.ink);
      if (cover) poster(); else scenes[shot.id](t - shot.start);
      // Caption-safe foundation: not a HUD and never draws narration itself.
      a.group(.32, () => a.rect(0, 396, W, 36, '#101c20'));
    } finally { ctx.restore(); }
    target.save();
    try {
      target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1;
      target.globalCompositeOperation = 'copy'; target.imageSmoothingEnabled = false;
      target.shadowBlur = 0; target.filter = 'none'; target.drawImage(surface, 0, 0);
    } finally { target.restore(); }
    state = { chapter: cover ? 'gate' : shot.chapter, shot: cover ? 'poster' : shot.id,
      time: t, progress: cover ? 0 : clamp((t - shot.start) / (shot.end - shot.start)), pov: true,
      viewpoint: cover ? 'cover' : t < 150 ? 'first-person' : 'imagined-afterward',
      reduced, poster: !!cover, width: W, height: H, renderer: 'original-pixel-canvas-2d' };
  }
  draw(0, { poster: true });
  return { draw, snapshot() { return canvas.toDataURL(); }, get state() { return { ...state }; } };
}