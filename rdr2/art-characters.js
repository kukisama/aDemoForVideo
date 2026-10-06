/* Original, stylized Western actors. Coordinates are feet/wheel contact points.
 * Plain script: const actors = createWesternActors(); no assets or dependencies.
 * palette accepts hex overrides for the person color keys below. Optional camp
 * variant (0..3) stays fixed as an actor moves; never derives identity from time.
 */
function createWesternActors() {
  'use strict';
  const INK = '#211c20';
  const palettes = {
    arthur: { skin: '#c99871', hair: '#654333', hat: '#b39869', shirt: '#567f96', vest: '#38576e', pants: '#504a43', boots: '#302b29', accent: '#9e7153', bag: '#77533b' },
    dutch: { skin: '#d1a782', hair: '#342c2b', hat: '#302c30', shirt: '#dfd9c5', vest: '#343137', pants: '#444047', boots: '#262329', accent: '#a9463e', bag: '#634737' },
    camp: { skin: '#b98c65', hair: '#514033', hat: '#807258', shirt: '#93906c', vest: '#68674e', pants: '#605447', boots: '#332d29', accent: '#c29157', bag: '#73543b' },
    woman: { skin: '#d4a27f', hair: '#543932', hat: '#9d7958', shirt: '#ad796d', vest: '#825550', pants: '#78545b', boots: '#352b30', accent: '#dec4a0', bag: '#725043' },
    traveler: { skin: '#a87955', hair: '#3e3430', hat: '#837359', shirt: '#a39981', vest: '#777265', pants: '#575b50', boots: '#312f2c', accent: '#ad914f', bag: '#8a6042' }
  };
  const owns = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
  const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const optionsOf = value => value && typeof value === 'object' ? value : {};
  const choose = (value, choices, fallback) => choices.includes(value) ? value : fallback;
  const hex = (value, fallback) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ? value : fallback;
  const clock = time => number(time, 0) % 3600;
  const scaleOf = value => { const n = number(value, 1); return n > 0 ? n : 1; };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const loop = (time, duration) => ((time % duration) + duration) % duration / duration;
  const wave = (time, period) => Math.sin(loop(time, period) * Math.PI * 2);
  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  function poly(ctx, color, points) {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
    ctx.closePath(); ctx.fill();
  }
  // Square-pixel lines, including diagonals: no antialiased strokes or circles.
  function line(ctx, color, x1, y1, x2, y2, width = 1) {
    x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i++) rect(ctx, color, x1 + (x2 - x1) * i / steps - Math.floor(width / 2), y1 + (y2 - y1) * i / steps - Math.floor(width / 2), width, width);
  }
  function limb(ctx, a, b, c, color, width = 3) {
    line(ctx, INK, ...a, ...b, width + 2); line(ctx, INK, ...b, ...c, width + 2);
    line(ctx, color, ...a, ...b, width); line(ctx, color, ...b, ...c, width);
  }
  function placed(ctx, x, y, options, draw) {
    ctx.save();
    try {
      ctx.translate(Math.round(number(x, 0)), Math.round(number(y, 0)));
      const scale = scaleOf(options.scale);
      ctx.scale(number(options.facing, 1) < 0 ? -scale : scale, scale);
      ctx.imageSmoothingEnabled = false;
      draw();
    } finally { ctx.restore(); }
  }
  function colors(identity, overrides) {
    const result = { ...palettes[identity] };
    overrides = optionsOf(overrides);
    Object.keys(result).forEach(key => { result[key] = hex(overrides[key], result[key]); });
    return result;
  }
  // riding is internal: the same identity art, with bent legs and rein hands.
  function drawPerson(ctx, time, options, riding = false) {
    const id = owns(palettes, options.identity) ? options.identity : 'arthur';
    const variant = Math.floor(clamp(number(options.variant, 0), 0, 3));
    const dress = id === 'woman' || (id === 'camp' && variant === 3);
    const p = colors(id, options.palette);
    if (id === 'camp' && !options.palette) {
      p.shirt = ['#93906c', '#aa7558', '#6e8990', '#ae8170'][variant];
      p.skin = ['#b98c65', '#936a4e', '#d0a77e', '#bd8d68'][variant];
    }
    const action = choose(options.action, ['idle', 'walk', 'point', 'lantern', 'journal', 'sit', 'reach'], 'idle');
    const seated = riding || action === 'sit';
    const stride = action === 'walk' && !seated ? wave(time, 0.85) : 0;
    const breath = Math.round(wave(time, 3.4) * 0.55);
    const bob = stride ? -Math.round(Math.abs(stride)) : breath;
    const height = id === 'camp' ? [1, 3, -1, 1][variant] : id === 'traveler' ? -1 : 0;
    const top = (riding ? -6 : seated ? 2 : 0) + height + bob;
    const lean = seated ? 2 : action === 'reach' ? 1 : 0;
    const hip = [lean, -11 + top];
    const footLift = action === 'walk' && !seated ? wave(time + 0.85 / 4, 0.85) : 0;
    const backFoot = seated ? [-2, -1] : [-3 - stride * 4, -1 - Math.max(0, footLift) * 2];
    const frontFoot = seated ? [8, -1] : [2 + stride * 4, -1 - Math.max(0, -footLift) * 2];
    limb(ctx, [hip[0] - 2, hip[1]], seated ? [-5, -5] : [-3 - stride * 2, -6], backFoot, p.pants, 3);
    rect(ctx, INK, backFoot[0] - 2, backFoot[1] - 2, 6, 3); rect(ctx, p.boots, backFoot[0] - 1, backFoot[1] - 1, 5, 2);
    limb(ctx, [hip[0] + 2, hip[1]], seated ? [8, -7] : [3 + stride * 2, -6 - Math.max(0, -stride) * 2], frontFoot, p.pants, 3);
    rect(ctx, INK, frontFoot[0] - 2, frontFoot[1] - 2, 6, 3); rect(ctx, p.boots, frontFoot[0] - 1, frontFoot[1] - 1, 5, 2);
    if (dress) {
      poly(ctx, INK, [[-5, -14 + top], [4, -14 + top], [8, -2], [-8, -2]]);
      poly(ctx, p.pants, [[-4, -13 + top], [3, -13 + top], [6, -3], [-6, -3]]);
      line(ctx, p.accent, -2, -11 + top, -3 + stride, -4);
    }
    // Far sleeve precedes the torso; near sleeve follows props and head.
    limb(ctx, [-4 + lean, -21 + top], [-6 - stride * 2, -16 + top], [-5 - stride * 4, -12 + top], p.shirt, 2);
    poly(ctx, INK, [[-5 + lean, -23 + top], [4 + lean, -23 + top], [6 + lean, -10 + top], [-6 + lean, -10 + top]]);
    poly(ctx, p.shirt, [[-4 + lean, -22 + top], [3 + lean, -22 + top], [4 + lean, -11 + top], [-4 + lean, -11 + top]]);
    rect(ctx, p.vest, -3 + lean, -21 + top, 6, 10);
    line(ctx, p.shirt, 1 + lean, -20 + top, 1 + lean, -13 + top);
    rect(ctx, p.bag, -5 + lean, -12 + top, 10, 2); rect(ctx, '#cfb783', 1 + lean, -12 + top, 2, 1);
    if (id !== 'dutch') {
      line(ctx, p.bag, 3 + lean, -22 + top, -4 + lean, -12 + top, 2);
      rect(ctx, INK, -7 + lean, -14 + top, 5, 6); rect(ctx, p.bag, -6 + lean, -13 + top, 3, 4);
      rect(ctx, '#ba9264', -5 + lean, -12 + top, 1, 1);
    }
    rect(ctx, INK, -3 + lean, -29 + top, 8, 8);
    rect(ctx, p.skin, -2 + lean, -28 + top, 6, 6); rect(ctx, p.skin, 4 + lean, -26 + top, 2, 2);
    rect(ctx, p.hair, -3 + lean, -28 + top, 2, dress ? 9 : 4);
    rect(ctx, INK, 3 + lean, -26 + top, 1, 1);
    if (id === 'arthur') { rect(ctx, p.hair, -1 + lean, -23 + top, 6, 2); rect(ctx, p.hair, 3 + lean, -24 + top, 2, 1); }
    if (id === 'dutch') { rect(ctx, p.hair, 2 + lean, -24 + top, 4, 1); rect(ctx, p.hair, 1 + lean, -23 + top, 1, 1); }
    if (dress) {
      rect(ctx, p.hair, -3 + lean, -30 + top, 7, 3); rect(ctx, p.accent, -4 + lean, -28 + top, 2, 2);
    } else {
      poly(ctx, INK, [[-6 + lean, -28 + top], [-4 + lean, -32 + top], [3 + lean, -32 + top], [5 + lean, -29 + top], [9 + lean, -28 + top], [8 + lean, -26 + top], [-8 + lean, -27 + top]]);
      rect(ctx, p.hat, -3 + lean, -31 + top, 6, 3); rect(ctx, p.hat, -7 + lean, -28 + top, 15, 1);
      rect(ctx, id === 'arthur' ? '#d3bb89' : p.accent, -3 + lean, -30 + top, 2, 1);
      rect(ctx, p.bag, -3 + lean, -29 + top, 7, 1);
    }
    rect(ctx, p.accent, -1 + lean, -22 + top, 5, 2);
    rect(ctx, p.accent, 2 + lean, -20 + top, 2, id === 'dutch' ? 5 : 2);
    let elbow = [6 + lean + stride * 2, -17 + top], hand = [5 + lean + stride * 4, -12 + top];
    if (action === 'point' || action === 'reach') {
      const u = loop(time, action === 'point' ? 4 : 3.2);
      const lift = Math.min(1, u / 0.2, (1 - u) / 0.25);
      elbow = [6 + lift * 3 + lean, -17 + top - lift * 3];
      hand = [5 + lift * 11 + lean, -12 + top - lift * (action === 'point' ? 13 : 7)];
      if (action === 'point') rect(ctx, p.skin, hand[0], hand[1] - 1, lift > 0.7 ? 4 : 2, 1);
      else if (u > 0.3 && u < 0.7) rect(ctx, INK, hand[0] + 1, hand[1], 2, 3);
    } else if (action === 'lantern') {
      hand = [9 + wave(time, 2.8), -13 + top]; elbow = [7, -18 + top];
      const lx = Math.round(hand[0]), ly = Math.round(hand[1] + 4);
      line(ctx, '#a89167', lx, ly - 3, lx - 2, ly); line(ctx, '#a89167', lx, ly - 3, lx + 2, ly);
      rect(ctx, INK, lx - 3, ly, 7, 8); rect(ctx, '#b47c3f', lx - 2, ly + 1, 5, 6);
      rect(ctx, '#f3c16b', lx - 1, ly + 2, 3, 4); rect(ctx, '#fff0b4', lx, ly + 2, 1, 3);
      rect(ctx, '#594839', lx - 3, ly + 7, 7, 1);
    } else if (action === 'journal') {
      const opening = Math.min(1, loop(time, 5) / 0.16), width = 3 + Math.round(opening * 3);
      limb(ctx, [-4 + lean, -21 + top], [-2, -15 + top], [7, -15 + top], p.shirt, 2);
      poly(ctx, '#543a2d', [[3, -18 + top], [8, -17 + top], [8 + width, -19 + top], [9 + width, -13 + top], [8, -12 + top], [3, -13 + top]]);
      rect(ctx, '#e0cda3', 4, -17 + top, 4, 4); rect(ctx, '#eee0bd', 9, -17 + top, width - 1, 4);
      line(ctx, '#927756', 8, -17 + top, 8, -13 + top);
      elbow = [6, -20 + top]; hand = [9 + Math.round(wave(time, 0.55)), -16 + top];
      line(ctx, '#4e4235', hand[0], hand[1], hand[0] + 2, hand[1] - 4);
    } else if (seated) {
      elbow = riding ? [8, -13 + top] : [8, -8]; hand = riding ? [13, -18 + top] : [7, -20 + top];
    }
    limb(ctx, [4 + lean, -21 + top], elbow, hand, p.shirt, 2);
    rect(ctx, p.skin, hand[0] - 1, hand[1] - 1, 3, 3);
    if (action === 'reach' && loop(time, 3.2) > 0.3 && loop(time, 3.2) < 0.7) rect(ctx, p.hair, hand[0] + 1, hand[1], 1, 2);
  }
  function person(ctx, x, groundY, time, options = {}) {
    options = optionsOf(options);
    placed(ctx, x, groundY, options, () => drawPerson(ctx, clock(time), options));
  }
  function horse(ctx, x, groundY, time, options = {}) {
    options = optionsOf(options);
    const riderIdentity = owns(palettes, options.rider) ? options.rider : null;
    const t = clock(clock(time) * Math.max(0, number(options.speed, 1)));
    const gait = choose(options.gait, ['gallop', 'walk', 'idle'], 'walk');
    const moving = gait !== 'idle' && number(options.speed, 1) > 0;
    const period = gait === 'gallop' ? 0.58 : 1.3;
    const phase = loop(t, period) * Math.PI * 2;
    const bounce = moving ? Math.round(Math.sin(phase * 2) * (gait === 'gallop' ? 2 : 0.7)) : 0;
    const coats = { bay: ['#865137', '#b47a4b', '#553829'], black: ['#3f3c40', '#64616a', '#29272d'], cream: ['#c7af85', '#e7d0a0', '#8b795f'] };
    const coat = owns(coats, options.coat) ? coats[options.coat] : [hex(options.coat, coats.bay[0]), '#b99470', '#554237'];
    const [body, light, shade] = coat;
    placed(ctx, x, groundY, options, () => {
      if (moving && options.dust !== false) {
        for (let i = 0; i < 7; i++) {
          const age = loop(t + i * 0.193, 1.1), size = 1 + Math.floor(age * 3);
          ctx.save(); ctx.globalAlpha *= (1 - age) * 0.35;
          rect(ctx, '#bc9c72', -16 - age * 27 - (i % 3) * 2, -2 - age * (3 + i % 4), size + 2, size);
          ctx.restore();
        }
      }
      function leg(front, far) {
        const offset = gait === 'gallop' ? (front ? 0 : 2.1) + (far ? 0.7 : 0) : (front ? 0 : Math.PI) + (far ? Math.PI : 0);
        const a = phase + offset, stride = moving ? Math.sin(a) : 0;
        const lift = moving ? Math.max(0, Math.cos(a)) * (gait === 'gallop' ? 7 : 3) : 0;
        const root = [front ? 11 : -13, -18 + bounce];
        const knee = [root[0] + stride * (gait === 'gallop' ? 7 : 4) + (front ? -2 : 3), -9 + bounce - lift * 0.3];
        const foot = [root[0] + stride * (gait === 'gallop' ? 13 : 6), -2 - lift];
        limb(ctx, root, knee, foot, far ? shade : body, 2);
        rect(ctx, INK, foot[0] - 2, foot[1], 5, 2);
        if (!far) rect(ctx, '#b4a08b', foot[0] - 1, foot[1], 3, 1);
      }
      leg(false, true); leg(true, true);
      const tail = wave(t, moving ? 0.65 : 3) * (moving ? 3 : 1);
      poly(ctx, INK, [[-17, -25 + bounce], [-23, -24 + bounce], [-26, -13 + tail], [-30, -10 + tail], [-27, -18 + tail], [-24, -27 + bounce]]);
      line(ctx, shade, -22, -24 + bounce, -26, -14 + tail, 2);
      poly(ctx, INK, [[-20, -27 + bounce], [-11, -29 + bounce], [9, -28 + bounce], [17, -24 + bounce], [16, -18 + bounce], [8, -14 + bounce], [-12, -15 + bounce], [-21, -20 + bounce]]);
      poly(ctx, body, [[-19, -25 + bounce], [-11, -27 + bounce], [9, -26 + bounce], [15, -23 + bounce], [13, -18 + bounce], [6, -16 + bounce], [-12, -17 + bounce], [-19, -21 + bounce]]);
      poly(ctx, light, [[-17, -25 + bounce], [-10, -27 + bounce], [6, -26 + bounce], [10, -23 + bounce], [-10, -23 + bounce]]);
      poly(ctx, shade, [[-18, -21 + bounce], [-8, -19 + bounce], [12, -20 + bounce], [7, -16 + bounce], [-12, -17 + bounce]]);
      leg(false, false); leg(true, false);
      const pitch = Math.round(moving ? Math.sin(phase) : wave(t, 4));
      poly(ctx, INK, [[7, -26 + bounce], [12, -36 + pitch + bounce], [18, -39 + pitch + bounce], [23, -35 + pitch + bounce], [26, -32 + pitch + bounce], [29, -30 + pitch + bounce], [27, -26 + pitch + bounce], [20, -28 + pitch + bounce], [17, -20 + bounce], [11, -18 + bounce]]);
      poly(ctx, body, [[9, -26 + bounce], [14, -35 + pitch + bounce], [18, -37 + pitch + bounce], [22, -33 + pitch + bounce], [27, -30 + pitch + bounce], [26, -28 + pitch + bounce], [19, -30 + pitch + bounce], [15, -22 + bounce]]);
      line(ctx, light, 16, -35 + pitch + bounce, 12, -25 + bounce, 2);
      poly(ctx, INK, [[15, -36 + pitch + bounce], [15, -41 + pitch + bounce], [18, -38 + pitch + bounce], [20, -40 + pitch + bounce], [21, -35 + pitch + bounce]]);
      for (let i = 0; i < 5; i++) rect(ctx, shade, 11 - i + (moving ? Math.round(Math.sin(phase + i)) : 0), -35 + i * 2 + bounce + pitch, 3, 4);
      rect(ctx, '#e6cd9b', 22, -33 + pitch + bounce, 1, 1); rect(ctx, INK, 23, -33 + pitch + bounce, 1, 1);
      rect(ctx, INK, 26, -29 + pitch + bounce, 2, 1);
      line(ctx, '#aa8961', 23, -32 + pitch + bounce, 24, -28 + pitch + bounce, 1);
      // Blanket, cinch, saddle, horn, stirrup, then rider and loose reins.
      rect(ctx, INK, -9, -29 + bounce, 17, 7); rect(ctx, '#92624e', -8, -28 + bounce, 15, 5);
      rect(ctx, '#c7a276', -7, -24 + bounce, 13, 1); rect(ctx, '#4e392c', 0, -23 + bounce, 3, 7);
      poly(ctx, '#463329', [[-8, -30 + bounce], [-5, -27 + bounce], [4, -27 + bounce], [6, -30 + bounce], [8, -29 + bounce], [7, -25 + bounce], [-8, -25 + bounce]]);
      rect(ctx, '#a58258', 6, -31 + bounce, 2, 3); rect(ctx, '#b6a486', 0, -16 + bounce, 4, 2);
      if (riderIdentity) {
        ctx.save();
        try { ctx.translate(-2, -15 + bounce); ctx.scale(0.7, 0.7); drawPerson(ctx, t, { identity: riderIdentity, action: 'sit', variant: number(options.riderVariant, 0) }, true); }
        finally { ctx.restore(); }
      }
      const reinY = riderIdentity ? -32 : -27;
      line(ctx, '#382c26', 24, -28 + pitch + bounce, 15, -23 + bounce);
      line(ctx, '#382c26', 15, -23 + bounce, 7, reinY + bounce);
    });
  }
  function wagon(ctx, x, groundY, time, options = {}) {
    options = optionsOf(options);
    const t = clock(time), moving = options.moving !== false;
    const bounce = moving ? Math.round(wave(t, 0.8) * 0.7) : 0;
    const occupants = Math.floor(clamp(number(options.occupants, 1), 0, 4));
    placed(ctx, x, groundY, options, () => {
      const y = bounce;
      // Tongue and undercarriage leave room for separately drawn draft animals.
      line(ctx, INK, 32, -16 + y, 62, -11 + y, 5); line(ctx, '#826044', 32, -17 + y, 61, -12 + y, 2);
      rect(ctx, INK, -40, -20 + y, 81, 9); rect(ctx, '#59402d', -38, -18 + y, 77, 5);
      rect(ctx, '#ae8150', -40, -28 + y, 77, 9); rect(ctx, '#45332a', -41, -29 + y, 79, 2);
      for (let i = 0; i < 3; i++) rect(ctx, '#785335', -39, -25 + i * 3 + y, 75, 1);
      for (const sx of [-34, -8, 17, 33]) { rect(ctx, '#503b2d', sx, -29 + y, 3, 12); rect(ctx, '#c1a171', sx, -27 + y, 1, 1); }
      if (options.covered !== false) {
        const arch = [[-39, -29 + y], [-39, -45 + y], [-36, -52 + y], [-30, -57 + y], [-21, -60 + y], [13, -60 + y], [23, -57 + y], [29, -51 + y], [32, -44 + y], [32, -29 + y]];
        poly(ctx, INK, arch);
        poly(ctx, '#d4c9ab', [[-37, -30 + y], [-37, -44 + y], [-34, -51 + y], [-28, -55 + y], [-20, -58 + y], [12, -58 + y], [22, -55 + y], [27, -50 + y], [30, -43 + y], [30, -30 + y]]);
        poly(ctx, '#eee5cb', [[-34, -47 + y], [-30, -53 + y], [-20, -57 + y], [12, -57 + y], [22, -54 + y], [26, -49 + y], [-20, -50 + y]]);
        // Stepped ribs and a dark open front, not a solid circular canopy.
        for (const rx of [-29, -10, 9]) {
          line(ctx, '#a69b81', rx - 5, -31 + y, rx - 5, -43 + y);
          line(ctx, '#a69b81', rx - 5, -43 + y, rx - 2, -52 + y);
          line(ctx, '#a69b81', rx - 2, -52 + y, rx + 3, -57 + y);
        }
        poly(ctx, '#494139', [[22, -49 + y], [26, -44 + y], [28, -38 + y], [28, -30 + y], [17, -30 + y], [17, -46 + y]]);
        line(ctx, '#f4e9cc', 20, -49 + y, 25, -42 + y, 2);
        for (const tie of [-33, -14, 5]) line(ctx, '#71614a', tie, -32 + y, tie + 2, -28 + y);
      }
      // Supplies: faceted barrel with hoops and a rolled wool blanket.
      poly(ctx, INK, [[-34, -30 + y], [-35, -39 + y], [-32, -42 + y], [-24, -42 + y], [-21, -39 + y], [-22, -30 + y]]);
      rect(ctx, '#906341', -33, -39 + y, 10, 9); rect(ctx, '#bc905b', -31, -40 + y, 3, 10);
      rect(ctx, '#484642', -34, -38 + y, 12, 2); rect(ctx, '#484642', -34, -32 + y, 12, 2);
      rect(ctx, INK, -19, -36 + y, 20, 7); rect(ctx, '#71837c', -18, -35 + y, 18, 5);
      rect(ctx, '#bba980', -14, -35 + y, 2, 5); rect(ctx, '#bba980', -4, -35 + y, 2, 5);
      rect(ctx, '#455b56', -18, -34 + y, 3, 3); rect(ctx, '#97a296', -17, -33 + y, 1, 1);
      rect(ctx, INK, 25, -32 + y, 18, 4); rect(ctx, '#b18a56', 26, -31 + y, 16, 2);
      line(ctx, '#654832', 28, -28 + y, 28, -21 + y, 3); line(ctx, '#654832', 39, -28 + y, 39, -21 + y, 3);
      for (let i = occupants - 1; i >= 0; i--) {
        ctx.save();
        try {
          ctx.translate(35 - i * 12, -23 + y); ctx.scale(0.68, 0.68);
          drawPerson(ctx, t + i, { identity: i === 0 ? 'traveler' : i === 1 ? 'woman' : 'camp', action: 'sit', variant: i });
        } finally { ctx.restore(); }
      }
      function wheel(cx) {
        const cy = -11, r = 11;
        const octagon = radius => Array.from({ length: 12 }, (_, i) => {
          const a = i * Math.PI / 6; return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
        });
        poly(ctx, INK, octagon(r)); poly(ctx, '#9e774a', octagon(r - 1)); poly(ctx, '#3d342e', octagon(r - 3));
        const angle = moving ? loop(t, 2.2) * Math.PI * 2 : 0;
        for (let i = 0; i < 8; i++) {
          const a = angle + i * Math.PI / 4;
          line(ctx, '#bf965d', cx, cy, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 1);
        }
        rect(ctx, INK, cx - 3, cy - 3, 6, 6); rect(ctx, '#c1a073', cx - 2, cy - 2, 4, 4); rect(ctx, '#60534a', cx, cy - 1, 1, 2);
      }
      wheel(-28); wheel(28);
    });
  }
  return { person, horse, wagon };
}