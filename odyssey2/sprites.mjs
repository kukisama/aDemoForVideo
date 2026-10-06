/**
 * Original, articulated pixel actors for 空弦. No imported artwork or render loop.
 * Coordinates are authored at native resolution, relative to the fixed sole pivot.
 * Positive x faces the opponent; positive y is down. World x/y/z are NEVER applied.
 * A caller may upload the canvas at 24 Hz; draw is deterministic and seek-safe.
 */
const W = 256, H = 192, OX = 128, OY = 162;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const lerp = (a, b, t) => a + (b - a) * t;
const rad = n => n * Math.PI / 180;
const point = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// 46 opaque inks, including the silhouette. No gradients, filtered strokes or AA.
const INKS = [
  '#00000000', '#11151e', '#202532', '#343744',
  '#47392f', '#785044', '#a46c50', '#cf9366', '#e8b885', '#f6d5a4',
  '#20212a', '#373741', '#57545a', '#8b8581', '#c0b8a6',
  '#4c3829', '#795333', '#ab7742', '#d2a05a', '#f0c97c', '#ffe5a3',
  '#44362e', '#72543c', '#a77c51',
  '#6d6555', '#a49a7d', '#d2c5a1', '#f1e3ba',
  '#321f2c', '#592533', '#863344', '#b44b51', '#d27268',
  '#16383f', '#24545a', '#3c7d80', '#70aaa5', '#b1d3c2',
  '#3c5362', '#6d8995', '#a6bfca', '#e0ece8',
  '#1e2640', '#303d5b', '#4c5b7c', '#74849b', '#faf0cd',
];
const C = Object.freeze({
  ink: 1, shade: 2, edge: 3,
  skinDeep: 4, skinShadow: 5, skin: 6, skinMid: 7, skinLight: 8, skinHigh: 9,
  hair: 10, hairMid: 11, hairLight: 12, beard: 13, beardLight: 14,
  bronzeDeep: 15, bronzeShadow: 16, bronze: 17, bronzeMid: 18, bronzeLight: 19, gold: 20,
  leather: 21, leatherMid: 22, leatherLight: 23,
  linenDeep: 24, linenShadow: 25, linen: 26, linenLight: 27,
  redDeep: 28, redShadow: 29, red: 30, redLight: 31, redHigh: 32,
  tealDeep: 33, tealShadow: 34, teal: 35, tealLight: 36, tealHigh: 37,
  steelDeep: 38, steel: 39, steelLight: 40, silver: 41,
  navyDeep: 42, navy: 43, navyLight: 44, navyHigh: 45, glint: 46,
});
const RGBA = INKS.map((hex, i) => i ? [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
] : [0, 0, 0]);

// Each hand-authored key contains pelvis x/y, lean, chest foreshortening,
// sword elbow/wrist, shield elbow/wrist, far knee/ankle, near knee/ankle,
// UNWRAPPED weapon angle and head counter-rotation. Shoulders and neck follow
// the rigid torso, not the hands. Timings include short impact holds, not sine poses.
const F = (t, body, arm, off, far, near, angle, head = 0) => ({
  t, v: [...body, ...arm, ...off, ...far, ...near, angle, head],
});
const HERO = {
  idle: [
    F(0, [0,-48,-3,1], [-12,-66,4,-57], [15,-71,24,-65], [-15,-28,-19,-6], [14,-27,19,-6], -67, 2),
    F(1, [0,-48,-3,1], [-12,-66,4,-57], [15,-71,24,-65], [-15,-28,-19,-6], [14,-27,19,-6], -67, 2),
  ],
  bow: [
    F(0, [0,-48,0,.94], [19,-64,31,-67], [24,-77,41,-78], [-13,-27,-20,-6], [18,-27,26,-6], -65),
    F(.26, [-2,-48,-3,.86], [8,-65,22,-81], [24,-82,46,-85], [-14,-28,-23,-6], [18,-28,28,-6], -60, 3),
    F(.72, [-5,-49,-7,.76], [-21,-86,0,-86], [22,-86,44,-87], [-17,-29,-25,-6], [17,-28,28,-6], -60, 5),
    F(1, [-6,-49,-8,.70], [-28,-89,-7,-88], [21,-88,44,-89], [-18,-28,-26,-6], [17,-29,28,-6], -60, 6),
  ],
  release: [
    F(0, [-6,-49,-8,.70], [-28,-89,-7,-88], [21,-88,44,-89], [-18,-28,-26,-6], [17,-29,28,-6], -60, 6),
    F(.13, [-9,-49,-12,.70], [-31,-92,-19,-91], [20,-87,43,-88], [-20,-29,-26,-6], [15,-29,28,-6], -60, 10),
    F(.4, [-8,-47,-8,.78], [-31,-85,-23,-78], [18,-80,40,-83], [-19,-28,-26,-6], [16,-28,28,-6], -65, 7),
    F(1, [-2,-48,-2,.93], [-17,-67,1,-62], [22,-75,39,-76], [-16,-28,-22,-6], [18,-28,25,-6], -65, 2),
  ],
  guard: [
    F(0, [-3,-44,6,.92], [-14,-65,1,-73], [23,-65,32,-78], [-20,-25,-29,-6], [20,-26,30,-6], -50, -5),
    F(.5, [-5,-42,11,.85], [-16,-63,0,-75], [23,-66,34,-81], [-23,-24,-32,-6], [20,-27,33,-6], -38, -7),
    F(1, [-2,-44,7,.92], [-13,-65,4,-73], [24,-67,34,-77], [-21,-25,-29,-6], [20,-27,31,-6], -56, -5),
  ],
  parry: [
    F(0, [-5,-42,9,.87], [-14,-62,-2,-74], [20,-67,28,-77], [-23,-24,-33,-6], [20,-26,33,-6], -52, -6),
    F(.36, [-3,-39,17,.75], [-16,-65,-2,-80], [29,-76,44,-88], [-25,-23,-35,-6], [23,-27,36,-6], -66, -12),
    F(.55, [-4,-38,16,.74], [-18,-65,-4,-80], [30,-76,45,-88], [-26,-22,-35,-6], [23,-26,36,-6], -68, -12),
    F(.68, [-12,-36,2,.78], [-20,-64,-6,-74], [16,-70,29,-81], [-29,-22,-37,-6], [17,-25,35,-6], -80, -1),
    F(1, [-6,-42,7,.90], [-16,-63,0,-74], [24,-67,34,-80], [-23,-24,-33,-6], [21,-26,33,-6], -54, -5),
  ],
  recoil: [
    F(0, [-3,-43,4,.9], [-15,-61,3,-73], [22,-67,34,-77], [-20,-25,-29,-6], [21,-27,31,-6], -57),
    F(.34, [-13,-39,-23,.72], [-30,-64,-16,-49], [-1,-66,14,-73], [-30,-22,-38,-6], [12,-26,35,-6], -12, 14),
    F(.66, [-17,-33,-17,.79], [-38,-48,-27,-34], [-6,-61,12,-65], [-33,-20,-39,-6], [11,-24,35,-6], 24, 7),
    F(1, [-6,-40,4,.88], [-19,-57,-5,-62], [16,-63,28,-73], [-24,-23,-34,-6], [19,-25,33,-6], -40, -3),
  ],
  crouch: [
    F(0, [-6,-35,17,.9], [-9,-51,7,-57], [27,-56,36,-64], [-25,-19,-34,-6], [25,-20,34,-6], -27, -12),
    F(.42, [-9,-17,29,.78], [-6,-34,11,-36], [29,-37,38,-47], [-33,-13,-39,-6], [27,-15,40,-6], -12, -18),
    F(.72, [-11,-15,32,.72], [-7,-31,11,-32], [29,-34,39,-44], [-35,-12,-41,-6], [28,-14,41,-6], -8, -20),
    F(1, [-8,-23,26,.80], [-8,-40,9,-43], [29,-44,39,-53], [-29,-16,-37,-6], [26,-18,38,-6], -21, -17),
  ],
  dash: [
    F(0, [-10,-29,33,.74], [-15,-42,-32,-47], [22,-53,35,-52], [-33,-17,-48,-6], [21,-18,37,-6], -150, -23),
    F(.28, [-2,-39,36,.70], [-16,-52,-32,-57], [27,-59,40,-66], [-29,-23,-57,-6], [28,-27,36,-6], -151, -25),
    F(.65, [4,-38,39,.68], [-12,-52,-30,-55], [34,-57,47,-65], [-26,-24,-56,-6], [33,-27,43,-6], -155, -27),
    F(1, [7,-33,31,.82], [-3,-51,-20,-62], [37,-51,46,-62], [-21,-21,-51,-6], [34,-23,46,-6], -136, -22),
  ],
  slash: [
    F(0, [-9,-36,-15,.95], [-25,-63,-30,-80], [12,-53,24,-64], [-29,-23,-38,-6], [17,-24,34,-6], -149, 12),
    F(.30, [-11,-34,-21,.57], [-34,-67,-38,-84], [5,-54,16,-67], [-30,-21,-40,-6], [17,-23,34,-6], -163, 14),
    F(.50, [1,-38,13,.64], [14,-78,34,-81], [9,-61,3,-49], [-22,-24,-37,-6], [28,-27,42,-6], -40, -12),
    F(.56, [5,-36,22,.94], [36,-68,56,-63], [9,-56,-2,-47], [-20,-24,-36,-6], [32,-25,45,-6], 4, -16),
    F(.65, [6,-35,25,.91], [36,-62,55,-55], [8,-54,-3,-45], [-19,-24,-36,-6], [32,-25,45,-6], 20, -17),
    F(1, [7,-32,29,.59], [25,-43,9,-35], [5,-53,-7,-46], [-18,-23,-35,-6], [33,-23,46,-6], 133, -20),
  ],
  slide: [
    F(0, [-9,-19,43,.76], [0,-32,-10,-37], [29,-33,34,-44], [-31,-12,-42,-6], [26,-15,40,-6], -147, -28),
    F(.35, [-9,-12,66,.69], [15,-20,1,-25], [34,-25,43,-32], [-36,-10,-62,-6], [24,-8,57,-6], -153, -43),
    F(.58, [-5,-12,69,.64], [21,-19,5,-25], [40,-23,47,-31], [-34,-10,-62,-6], [28,-8,64,-6], -153, -45),
    F(.86, [-5,-14,58,.67], [15,-24,0,-28], [32,-29,41,-37], [-31,-11,-57,-6], [31,-9,62,-6], -145, -37),
    F(1, [-9,-20,35,.78], [0,-36,-11,-40], [27,-38,35,-46], [-30,-14,-44,-6], [28,-14,44,-6], -135, -23),
  ],
  turn: [
    F(0, [-4,-40,12,.96], [-19,-62,-11,-77], [23,-59,31,-68], [-20,-24,-29,-6], [24,-25,34,-6], -128, -9),
    F(.38, [-5,-35,18,.43], [-9,-65,-19,-76], [9,-56,-5,-52], [-23,-22,-30,-6], [15,-23,18,-6], -185, -14),
    F(.62, [-3,-38,6,.50], [-17,-57,-5,-48], [-12,-61,-23,-69], [3,-23,20,-6], [-16,-25,-27,-6], -258, -4),
    F(1, [0,-43,7,.93], [-13,-64,3,-74], [22,-64,33,-77], [-19,-25,-29,-6], [20,-26,31,-6], -410, -5),
  ],
  uppercut: [
    F(0, [-12,-15,32,.73], [-11,-28,1,-18], [26,-32,34,-43], [-35,-12,-42,-6], [26,-13,41,-6], 25, -22),
    F(.18, [-13,-13,37,.63], [-10,-25,3,-14], [27,-29,36,-39], [-36,-11,-42,-6], [27,-12,42,-6], 36, -26),
    F(.40, [-2,-37,13,.83], [17,-55,31,-71], [12,-56,4,-47], [-21,-24,-35,-6], [26,-23,39,-6], -38, -9),
    F(.55, [3,-50,-9,.90], [25,-85,26,-110], [5,-73,-8,-64], [-15,-29,-30,-6], [22,-34,31,-15], -87, 5),
    F(.66, [4,-55,-14,.81], [24,-93,21,-113], [2,-78,-11,-68], [-10,-37,-22,-14], [25,-45,18,-25], -102, 10),
    F(1, [0,-54,-9,.77], [21,-91,15,-104], [-1,-77,-13,-65], [-18,-39,-28,-20], [26,-44,17,-27], -130, 7),
  ],
  air: [
    F(0, [0,-53,-7,.85], [19,-90,12,-105], [-3,-74,-15,-66], [-24,-43,-30,-25], [27,-44,15,-24], -117, 5),
    F(.4, [-3,-53,10,.68], [17,-81,4,-93], [23,-69,31,-80], [-25,-48,-18,-29], [26,-55,12,-34], -139, -9),
    F(.74, [-3,-46,20,.75], [5,-70,-8,-80], [27,-61,38,-71], [-29,-38,-39,-16], [25,-41,24,-21], -140, -16),
    F(1, [-3,-36,17,.87], [-8,-52,5,-62], [25,-49,35,-61], [-24,-23,-34,-6], [24,-25,34,-6], -50, -11),
  ],
  airSlash: [
    F(0, [-5,-55,-18,.64], [-28,-88,-32,-105], [7,-72,19,-82], [-27,-45,-19,-26], [24,-50,13,-31], -156, 12),
    F(.30, [-6,-54,-22,.47], [-33,-90,-38,-103], [2,-71,13,-80], [-29,-48,-19,-30], [23,-53,12,-33], -173, 16),
    F(.52, [3,-52,19,.85], [35,-84,52,-86], [5,-74,-7,-64], [-22,-47,-34,-29], [28,-49,19,-31], -18, -15),
    F(.59, [4,-50,25,.89], [39,-78,56,-71], [4,-70,-8,-60], [-23,-43,-36,-25], [28,-47,22,-28], 16, -20),
    F(1, [1,-43,33,.53], [22,-51,7,-44], [-1,-59,-14,-54], [-28,-34,-41,-16], [27,-39,29,-21], 145, -23),
  ],
  land: [
    F(0, [-1,-42,13,.86], [-12,-57,0,-68], [25,-56,36,-67], [-21,-27,-32,-6], [23,-28,34,-6], -52, -9),
    F(.18, [-5,-29,23,.81], [-7,-41,7,-46], [27,-43,38,-53], [-28,-17,-38,-6], [27,-18,38,-6], -18, -17),
    F(.49, [-10,-13,34,.68], [-2,-26,12,-25], [30,-28,40,-39], [-37,-11,-43,-6], [28,-12,43,-6], 6, -24),
    F(.62, [-10,-14,33,.69], [-2,-27,12,-26], [30,-29,40,-40], [-37,-11,-43,-6], [28,-12,43,-6], 4, -23),
    F(1, [-5,-40,11,.9], [-14,-61,2,-69], [24,-61,34,-74], [-22,-24,-32,-6], [22,-25,33,-6], -45, -7),
  ],
  spin: [
    F(0, [-6,-34,-16,.82], [-24,-63,-30,-79], [12,-52,20,-63], [-26,-22,-36,-6], [21,-22,34,-6], -157, 12),
    F(.26, [-5,-37,-12,.43], [-27,-58,-42,-67], [1,-63,-12,-71], [-18,-23,-23,-6], [12,-25,14,-6], -205, 9),
    F(.44, [0,-40,5,.51], [-19,-71,-39,-77], [-7,-63,-22,-51], [14,-23,31,-6], [-13,-25,-24,-6], -292, -3),
    F(.52, [4,-37,21,.94], [34,-70,55,-68], [7,-57,-5,-47], [29,-25,41,-6], [-18,-24,-33,-6], -362, -15),
    F(.61, [5,-35,25,.93], [37,-64,57,-58], [6,-55,-6,-45], [31,-23,43,-6], [-18,-22,-34,-6], -340, -18),
    F(1, [3,-36,17,.64], [21,-46,7,-38], [3,-56,-10,-48], [-21,-22,-32,-6], [28,-25,39,-6], -226, -12),
  ],
  run: [
    F(0, [0,-44,24,.86], [-18,-62,-30,-75], [27,-63,41,-68], [-24,-25,-44,-6], [26,-38,15,-20], -144, -18),
    F(.25, [2,-49,23,.79], [-13,-75,-9,-88], [24,-63,37,-52], [-9,-24,-17,-6], [26,-42,11,-30], -110, -17),
    F(.50, [1,-44,25,.85], [27,-66,42,-75], [-16,-59,-27,-50], [27,-34,13,-19], [-24,-24,-45,-6], -53, -18),
    F(.75, [-1,-48,24,.80], [21,-76,24,-89], [-19,-57,-31,-50], [21,-39,7,-26], [-9,-24,-16,-6], -87, -17),
    F(1, [0,-44,24,.86], [-18,-62,-30,-75], [27,-63,41,-68], [-24,-25,-44,-6], [26,-38,15,-20], -144, -18),
  ],
  thrust: [
    F(0, [-9,-40,-8,.73], [-25,-63,-18,-76], [15,-58,27,-70], [-27,-24,-38,-6], [20,-25,34,-6], -12, 6),
    F(.32, [-14,-37,-13,.63], [-30,-61,-25,-76], [11,-57,24,-69], [-30,-22,-42,-6], [19,-23,34,-6], -7, 9),
    F(.55, [8,-35,27,.80], [34,-68,59,-72], [12,-53,0,-46], [-20,-23,-42,-6], [35,-25,49,-6], -4, -19),
    F(.65, [9,-34,28,.79], [35,-66,60,-70], [12,-52,0,-45], [-20,-23,-42,-6], [36,-24,50,-6], -2, -20),
    F(1, [-3,-40,8,.86], [-2,-61,16,-72], [19,-61,30,-72], [-23,-24,-34,-6], [24,-26,36,-6], -36, -6),
  ],
  overhead: [
    F(0, [-4,-43,-6,.89], [-18,-85,-10,-106], [18,-62,28,-72], [-19,-26,-29,-6], [20,-26,31,-6], -148, 5),
    F(.30, [-9,-47,-19,.65], [-23,-96,-18,-116], [9,-77,4,-93], [-21,-28,-30,-6], [17,-30,30,-6], -161, 12),
    F(.51, [4,-33,27,.88], [28,-69,38,-80], [24,-62,32,-75], [-24,-22,-37,-6], [30,-24,43,-6], -34, -19),
    F(.58, [8,-20,43,.81], [36,-33,49,-27], [32,-35,43,-28], [-26,-13,-40,-6], [34,-15,48,-6], 40, -31),
    F(.70, [9,-18,47,.72], [37,-27,49,-20], [34,-29,43,-22], [-27,-12,-40,-6], [34,-14,48,-6], 26, -34),
    F(1, [3,-32,26,.87], [20,-43,31,-44], [27,-43,37,-52], [-23,-21,-36,-6], [29,-22,42,-6], 9, -18),
  ],
  airHurt: [
    F(0, [-4,-48,-25,.83], [-30,-77,-43,-94], [-3,-76,9,-87], [-22,-27,-31,-9], [22,-33,32,-16], -140, 16),
    F(.30, [-8,-51,-37,.62], [-39,-77,-51,-94], [-17,-80,-4,-92], [-25,-29,-38,-15], [16,-41,34,-24], -145, 24),
    F(.62, [-10,-43,-42,.58], [-45,-63,-57,-76], [-20,-70,-4,-76], [-28,-24,-43,-9], [10,-37,30,-24], -164, 27),
    F(1, [-8,-25,-26,.76], [-35,-41,-47,-51], [-9,-52,7,-59], [-27,-15,-39,-6], [13,-22,33,-6], -188, 16),
  ],
  kneel: [
    F(0, [-5,-35,13,.93], [-15,-48,0,-45], [24,-50,34,-57], [-26,-16,-36,-6], [25,-23,36,-6], 22, -7),
    F(.44, [-10,-20,22,.85], [-13,-33,3,-25], [25,-36,36,-37], [-30,-5,-44,-6], [25,-24,40,-6], 32, -12),
    F(.74, [-11,-19,27,.83], [-12,-29,4,-21], [27,-32,39,-33], [-31,-5,-45,-6], [26,-23,42,-6], 25, -6),
    F(1, [-11,-19,29,.83], [-11,-28,5,-20], [28,-31,40,-32], [-31,-5,-45,-6], [26,-23,42,-6], 23, -3),
  ],
};

// The sentinel is not the same fighter recoloured: his heavy set, planted feet,
// restrained reach, high spear recovery and shield-led impact have their own keys.
// Other actions are retargeted to his longer bones and broader shoulder girdle.
const SENTINEL = {
  uppercut: [
    F(0, [-14,-16,35,.88], [-18,-31,-5,-20], [26,-31,35,-41], [-37,-12,-44,-6], [28,-14,43,-6], 20, -23),
    F(.20, [-16,-14,39,.76], [-19,-27,-5,-16], [27,-28,37,-38], [-38,-11,-45,-6], [29,-12,44,-6], 28, -26),
    F(.41, [-5,-35,18,.9], [10,-59,24,-70], [24,-50,33,-63], [-26,-23,-40,-6], [29,-23,41,-6], -42, -12),
    F(.56, [0,-48,-6,.94], [22,-81,24,-97], [20,-67,25,-79], [-19,-30,-33,-6], [25,-36,33,-18], -83, 4),
    F(.68, [1,-52,-13,.85], [20,-83,18,-98], [14,-72,19,-82], [-16,-37,-26,-17], [25,-42,19,-26], -105, 9),
    F(1, [-3,-51,-9,.88], [14,-78,8,-90], [13,-66,22,-75], [-22,-37,-30,-20], [26,-42,18,-27], -138, 6),
  ],
  airSlash: [
    F(0, [-9,-52,-21,.82], [-31,-79,-35,-94], [13,-64,26,-74], [-29,-43,-22,-24], [25,-47,16,-28], -151, 14),
    F(.31, [-11,-50,-27,.56], [-37,-78,-40,-93], [5,-63,20,-75], [-30,-45,-20,-28], [23,-49,14,-30], -168, 19),
    F(.52, [1,-48,23,.93], [29,-74,43,-77], [20,-59,29,-51], [-25,-42,-35,-26], [29,-45,22,-28], -17, -16),
    F(.61, [3,-45,31,.91], [34,-66,47,-62], [22,-53,31,-47], [-25,-39,-37,-23], [30,-42,25,-25], 20, -22),
    F(1, [-1,-39,37,.66], [17,-43,2,-33], [16,-48,27,-40], [-30,-30,-42,-14], [29,-35,32,-20], 149, -25),
  ],
  spin: [
    F(0, [-10,-32,-20,.9], [-30,-60,-34,-75], [17,-48,27,-60], [-30,-20,-40,-6], [24,-21,38,-6], -154, 13),
    F(.28, [-9,-34,-15,.51], [-31,-52,-43,-61], [5,-56,-5,-68], [-23,-21,-28,-6], [16,-23,20,-6], -203, 10),
    F(.43, [-2,-37,9,.57], [-22,-61,-38,-68], [-3,-55,-15,-44], [18,-22,35,-6], [-17,-24,-29,-6], -289, -6),
    F(.53, [4,-32,28,.96], [28,-59,45,-58], [19,-47,27,-39], [32,-22,45,-6], [-23,-21,-38,-6], -362, -19),
    F(.63, [5,-30,33,.92], [30,-53,47,-47], [19,-43,29,-36], [34,-20,47,-6], [-23,-19,-38,-6], -335, -23),
    F(1, [1,-32,23,.72], [13,-40,-1,-30], [15,-46,26,-39], [-26,-20,-37,-6], [31,-23,43,-6], -219, -15),
  ],
  idle: [
    F(0, [0,-49,2,1], [-18,-64,-3,-65], [22,-65,28,-55], [-17,-27,-25,-6], [18,-27,26,-6], -75, -2),
    F(1, [0,-49,2,1], [-18,-64,-3,-65], [22,-65,28,-55], [-17,-27,-25,-6], [18,-27,26,-6], -75, -2),
  ],
  guard: [
    F(0, [-4,-44,9,.96], [-24,-62,-11,-76], [23,-60,32,-71], [-24,-24,-34,-6], [22,-25,34,-6], -22, -6),
    F(.5, [-7,-41,13,.91], [-27,-58,-15,-74], [25,-60,35,-75], [-28,-22,-38,-6], [24,-24,37,-6], -18, -9),
    F(1, [-4,-43,9,.96], [-24,-60,-11,-75], [24,-60,34,-72], [-25,-23,-35,-6], [23,-24,35,-6], -23, -6),
  ],
  parry: [
    F(0, [-5,-41,12,.91], [-26,-59,-13,-74], [24,-59,33,-71], [-26,-23,-36,-6], [23,-24,36,-6], -24, -8),
    F(.39, [-2,-34,24,.83], [-26,-56,-16,-72], [32,-60,43,-79], [-31,-18,-41,-6], [27,-21,40,-6], -34, -17),
    F(.55, [-3,-33,24,.82], [-27,-55,-17,-71], [33,-59,44,-78], [-32,-17,-41,-6], [28,-20,40,-6], -36, -17),
    F(.72, [-13,-32,7,.9], [-30,-51,-20,-67], [18,-57,30,-70], [-34,-17,-42,-6], [22,-20,40,-6], -44, -4),
    F(1, [-7,-40,12,.94], [-27,-58,-14,-73], [26,-58,35,-71], [-27,-22,-38,-6], [24,-24,37,-6], -24, -8),
  ],
  thrust: [
    F(0, [-10,-42,-6,.88], [-31,-64,-23,-77], [21,-58,32,-66], [-29,-23,-39,-6], [23,-25,36,-6], -5, 4),
    F(.30, [-14,-40,-10,.69], [-37,-61,-30,-75], [15,-57,29,-65], [-33,-22,-43,-6], [21,-23,36,-6], -3, 7),
    F(.52, [3,-34,26,.85], [24,-65,46,-69], [29,-49,38,-57], [-27,-22,-45,-6], [33,-23,46,-6], -3, -18),
    F(.60, [5,-33,28,.84], [26,-64,48,-68], [31,-48,40,-56], [-27,-21,-45,-6], [35,-22,48,-6], -2, -19),
    F(.70, [4,-33,27,.84], [25,-64,47,-68], [30,-48,39,-57], [-27,-21,-45,-6], [35,-22,48,-6], -2, -19),
    F(1, [-5,-40,11,.94], [-21,-58,-9,-71], [24,-56,34,-67], [-26,-22,-37,-6], [26,-24,38,-6], -18, -7),
  ],
  overhead: [
    F(0, [-4,-42,-9,.95], [-25,-79,-14,-100], [17,-64,26,-80], [-23,-24,-33,-6], [23,-26,34,-6], -151, 7),
    F(.29, [-11,-45,-24,.75], [-33,-90,-26,-108], [5,-73,-2,-91], [-27,-26,-36,-6], [19,-28,33,-6], -169, 17),
    F(.46, [-2,-36,8,.74], [13,-78,23,-92], [18,-63,28,-73], [-27,-23,-39,-6], [28,-23,41,-6], -69, -4),
    F(.57, [6,-19,47,.88], [32,-35,43,-28], [33,-32,38,-46], [-30,-12,-42,-6], [34,-14,47,-6], 24, -31),
    F(.67, [7,-16,52,.8], [34,-28,44,-24], [35,-27,41,-42], [-31,-11,-42,-6], [35,-12,48,-6], 20, -35),
    F(1, [0,-30,31,.94], [14,-45,24,-41], [29,-38,38,-49], [-26,-18,-39,-6], [30,-21,43,-6], 10, -21),
  ],
  slash: [
    F(0, [-11,-38,-16,.88], [-33,-64,-31,-82], [14,-53,26,-63], [-30,-22,-40,-6], [23,-23,37,-6], -155, 11),
    F(.34, [-14,-35,-24,.6], [-41,-66,-42,-81], [3,-53,18,-64], [-33,-20,-44,-6], [22,-21,37,-6], -173, 16),
    F(.55, [6,-32,29,.97], [28,-61,45,-59], [17,-49,25,-41], [-26,-21,-42,-6], [36,-21,48,-6], 4, -20),
    F(.65, [7,-30,33,.92], [31,-56,48,-52], [18,-46,27,-39], [-26,-20,-42,-6], [36,-20,48,-6], 19, -23),
    F(1, [5,-29,34,.63], [17,-38,3,-28], [11,-46,21,-37], [-25,-19,-41,-6], [35,-19,47,-6], 149, -23),
  ],
  recoil: [
    F(0, [-4,-42,7,.95], [-25,-57,-10,-71], [23,-58,33,-68], [-25,-22,-36,-6], [25,-24,36,-6], -25, -4),
    F(.37, [-16,-35,-24,.85], [-37,-55,-30,-40], [-1,-58,12,-66], [-35,-19,-43,-6], [16,-23,41,-6], 16, 16),
    F(.70, [-20,-27,-17,.88], [-39,-41,-31,-29], [-3,-47,10,-56], [-38,-14,-45,-6], [14,-22,40,-6], 10, 11),
    F(1, [-10,-37,4,.96], [-30,-50,-16,-57], [18,-53,29,-62], [-30,-19,-39,-6], [22,-22,36,-6], -16, -2),
  ],
  run: [
    F(0, [0,-42,20,.97], [-20,-60,-8,-67], [24,-53,30,-62], [-26,-25,-45,-6], [26,-32,16,-16], -24, -13),
    F(.25, [1,-46,19,.91], [-19,-65,-6,-72], [25,-57,33,-67], [-9,-24,-16,-6], [24,-38,12,-26], -20, -12),
    F(.5, [2,-41,23,.96], [-17,-57,-4,-64], [27,-50,35,-60], [26,-30,14,-15], [-25,-23,-44,-6], -23, -15),
    F(.75, [-1,-45,20,.91], [-22,-63,-10,-70], [25,-55,33,-65], [23,-36,10,-24], [-11,-23,-18,-6], -27, -13),
    F(1, [0,-42,20,.97], [-20,-60,-8,-67], [24,-53,30,-62], [-26,-25,-45,-6], [26,-32,16,-16], -24, -13),
  ],
  airHurt: [
    F(0, [-7,-45,-24,.93], [-35,-68,-44,-85], [-4,-64,9,-75], [-25,-24,-38,-8], [22,-32,35,-15], -130, 16),
    F(.34, [-12,-46,-40,.73], [-46,-69,-52,-85], [-16,-72,-5,-84], [-29,-27,-40,-13], [15,-37,34,-23], -151, 25),
    F(.67, [-14,-37,-47,.68], [-44,-53,-50,-65], [-23,-62,-7,-66], [-29,-23,-42,-8], [9,-32,31,-22], -156, 31),
    F(1, [-12,-22,-29,.86], [-42,-38,-49,-47], [-11,-48,4,-53], [-29,-13,-41,-6], [16,-22,36,-6], -182, 20),
  ],
  kneel: [
    F(0, [-8,-32,19,.96], [-21,-45,-7,-32], [26,-42,36,-48], [-29,-12,-39,-6], [26,-23,39,-6], 17, -9),
    F(.45, [-13,-18,31,.93], [-21,-31,-7,-22], [29,-29,39,-32], [-34,-5,-47,-6], [28,-22,43,-6], 13, -3),
    F(.75, [-14,-17,36,.89], [-19,-26,-6,-19], [31,-26,41,-29], [-35,-5,-48,-6], [29,-21,44,-6], 12, 5),
    F(1, [-14,-17,39,.88], [-18,-25,-5,-18], [33,-25,43,-27], [-35,-5,-48,-6], [29,-21,44,-6], 11, 8),
  ],
};

const CHANNELS = 22, RESOLUTION = 256;
const LUT = new Map();
function tableFor(identity, name) {
  const id = `${identity}/${name}`;
  if (LUT.has(id)) return LUT.get(id);
  const rival = identity === 'rival';
  const keys = (rival && SENTINEL[name]) || HERO[name];
  const table = new Float32Array((RESOLUTION + 1) * CHANNELS);
  let segment = 0;
  for (let i = 0; i <= RESOLUTION; i++) {
    const t = i / RESOLUTION;
    while (segment < keys.length - 2 && t > keys[segment + 1].t) segment++;
    const a = keys[segment], b = keys[segment + 1];
    const u = clamp((t - a.t) / (b.t - a.t));
    // Short authored intervals create snaps; longer intervals ease into silhouettes.
    const ease = u * u * (3 - 2 * u);
    for (let j = 0; j < CHANNELS; j++) {
      let value = lerp(a.v[j], b.v[j], ease);
      if (rival && j !== 2 && j !== 3 && j < 20) value *= j % 2 ? 1.10 : 1.12;
      // Keep BOTH grounded soles precisely at y=162 after retargeting.
      if (rival && (j === 15 || j === 19)) value += .6;
      table[i * CHANNELS + j] = value;
    }
  }
  LUT.set(id, table);
  return table;
}
function readPose(identity, name, phase, out) {
  const table = tableFor(identity, name), f = phase * RESOLUTION;
  const i = Math.min(RESOLUTION - 1, Math.floor(f)), u = f - i;
  for (let j = 0; j < CHANNELS; j++) out[j] = lerp(table[i * CHANNELS + j], table[(i + 1) * CHANNELS + j], u);
}

/** Integer scan conversion. All details, including diagonals, are opaque 1px cells. */
class Pixels {
  constructor() { this.data = new Uint8Array(W * H); this.crossings = []; this.clear(); }
  clear() { this.data.fill(0); this.x0 = W; this.y0 = H; this.x1 = -1; this.y1 = -1; }
  span(y, a, b, c) {
    y = Math.round(y); a = Math.max(0, Math.ceil(a)); b = Math.min(W - 1, Math.floor(b));
    if (y < 0 || y >= H || a > b) return;
    this.data.fill(c, y * W + a, y * W + b + 1);
    this.x0 = Math.min(this.x0, a); this.x1 = Math.max(this.x1, b);
    this.y0 = Math.min(this.y0, y); this.y1 = Math.max(this.y1, y);
  }
  dot(x, y, c, size = 1) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < size; j++) this.span(y + j, x, x + size - 1, c);
  }
  line(a, b, c, width = 1) {
    let x = Math.round(a[0]), y = Math.round(a[1]);
    const bx = Math.round(b[0]), by = Math.round(b[1]);
    const dx = Math.abs(bx - x), sx = x < bx ? 1 : -1;
    const dy = -Math.abs(by - y), sy = y < by ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.dot(x - Math.floor(width / 2), y - Math.floor(width / 2), c, width);
      if (x === bx && y === by) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }
  poly(points, fill, outline = 0) {
    const vertices = points.map(p => [Math.round(p[0]), Math.round(p[1])]);
    let low = H, high = -1;
    for (const p of vertices) { low = Math.min(low, p[1]); high = Math.max(high, p[1]); }
    for (let y = Math.max(0, low); y <= Math.min(H - 1, high); y++) {
      const hits = this.crossings; hits.length = 0;
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) this.span(y, hits[i], hits[i + 1], fill);
    }
    if (outline) for (let i = 0; i < vertices.length; i++) this.line(vertices[i], vertices[(i + 1) % vertices.length], outline);
  }
}

function localPainter(p, center, angle = 0, sx = 1, sy = 1) {
  const co = Math.cos(angle), si = Math.sin(angle);
  const at = (x, y) => [center[0] + x * sx * co - y * sy * si, center[1] + x * sx * si + y * sy * co];
  return {
    at,
    poly: (vertices, c, edge = 0) => p.poly(vertices.map(v => at(...v)), c, edge),
    line: (a, b, c, w = 1) => p.line(at(...a), at(...b), c, w),
    dot: (x, y, c, size = 1) => p.dot(...at(x, y), c, size),
  };
}
function tube(p, a, b, ra, rb, colors) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const q = (v, n) => [v[0] + nx * n, v[1] + ny * n];
  p.poly([q(a, -ra), q(a, ra), q(b, rb), q(b, -rb)], colors[0], C.ink);
  p.poly([q(a, -ra + 2), q(a, .7), q(b, .7), q(b, -rb + 2)], colors[1]);
  p.line(q(point(a, b, .16), -ra + 2), q(point(a, b, .72), -rb + 2), colors[2]);
}

function skeleton(v, rival, bowWeight = 0) {
  const pelvis = [OX + v[0], OY + v[1]], lean = rad(v[2]);
  const up = [Math.sin(lean), -Math.cos(lean)], side = [Math.cos(lean), Math.sin(lean)];
  const length = rival ? 44 : 40, width = rival ? 21 : 17;
  const at = (x, y) => [pelvis[0] + side[0] * x * v[3] - up[0] * y, pelvis[1] + side[1] * x * v[3] - up[1] * y];
  const pt = index => [OX + v[index], OY + v[index + 1]];
  return {
    pelvis, lean, twist: v[3], length, width, at,
    shoulder: at((width - 4)*(1-2*bowWeight), -length + 5), offShoulder: at((-width + 4)*(1-2*bowWeight), -length + 5),
    elbow: pt(4), hand: pt(6), offElbow: pt(8), offHand: pt(10),
    farHip: at(-8, 0), nearHip: at(8, 0), farKnee: pt(12), farAnkle: pt(14), nearKnee: pt(16), nearAnkle: pt(18),
    neck: at(0, -length - 3), head: at(1, -length - 17),
    headAngle: lean * .45 + rad(v[21]), weaponAngle: rad(v[20]),
  };
}

function cape(p, s, rival, pose, time, velocity) {
  const fast = ['dash','run','slide','airSlash','spin'].includes(pose);
  const spread = fast ? 36 : pose === 'recoil' || pose === 'airHurt' ? 20 : 0;
  // These are the ONLY time-driven deformations. Cloth tips move <= 2 pixels.
  const flutter = Math.sin(time * 8.3) * (fast ? 1.8 : .9);
  const drag = spread + Math.min(8, Math.abs(velocity) * 1.1);
  const top = s.at(-s.width + 5, -s.length + 1), right = s.at(9, -s.length + 3);
  const endY = Math.min(154, s.pelvis[1] + (rival ? 24 : 17) - spread * .27);
  const endX = s.pelvis[0] - 21 - drag;
  const colors = rival ? [C.navyDeep,C.navy,C.navyLight,C.navyHigh] : [C.redDeep,C.redShadow,C.red,C.redLight];
  const a = [endX - 7, endY - 10 + flutter], b = [endX + 5, endY + 3 + flutter];
  const c = [endX + 20, endY - 1 - flutter], d = [s.pelvis[0] + 5 - drag * .25, endY - 3];
  p.poly([top, [top[0]-8,top[1]+19], a, b, [b[0]+6,b[1]-5], c, d, right], colors[0], C.ink);
  p.poly([point(top,right,.25), [top[0]-4,top[1]+23], b, [b[0]+7,b[1]-6], [top[0]+5,top[1]+25]], colors[1]);
  p.poly([point(top,right,.58), [endX+12,endY-5], c, [c[0]+4,c[1]-6], right], colors[2]);
  p.poly([top,[top[0]-4,top[1]+23],a,[a[0]+8,a[1]-2]], colors[1]);
  p.line([top[0]+3,top[1]+7], [endX+11,endY-12], colors[3]);
  p.line([top[0]-4,top[1]+27], [a[0]+4,a[1]-6], colors[2]);
  p.line([c[0]-1,c[1]-7], [d[0]-4,d[1]-5], colors[3]);
  // A stitched, broken hem, rather than a smooth animated ribbon.
  for (let i = 0; i < 5; i++) {
    const h = point(a,b,i/5); p.dot(h[0]+3,h[1]-3, colors[3]);
  }
}

function leg(p, s, rival, near) {
  const hip = near ? s.nearHip : s.farHip, knee = near ? s.nearKnee : s.farKnee;
  const ankle = near ? s.nearAnkle : s.farAnkle;
  const flesh = near ? [C.skin,C.skinMid,C.skinLight] : [C.skinShadow,C.skin,C.skinMid];
  const metal = rival ? [C.steelDeep,C.steel,C.steelLight] : [C.bronzeShadow,C.bronze,C.bronzeLight];
  tube(p, hip, knee, rival ? 8 : 6, rival ? 6 : 4.5, rival ? metal : flesh);
  // Articulated knee cap, greave crest and calf straps; not a straight stick leg.
  const k = localPainter(p,knee,Math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])-Math.PI/2);
  k.poly([[-5,-4],[2,-5],[6,0],[3,5],[-4,4]],metal[0],C.ink);
  k.poly([[-2,-3],[2,-3],[4,0],[1,3],[-2,2]],metal[2]);
  tube(p, point(knee,ankle,.14), ankle, rival ? 6.5 : 5, 4, metal);
  for (const t of [.27,.76]) {
    const a = point(knee,ankle,t); p.line([a[0]-4,a[1]+1],[a[0]+3,a[1]-1],rival?C.tealDeep:C.leather,2);
    p.dot(a[0]+2,a[1]-1,rival?C.silver:C.gold);
  }
  const lift = ankle[1] < OY - 9;
  const tilt = lift ? clamp((ankle[0]-knee[0])/30,-.65,.65) : 0;
  const foot = localPainter(p,ankle,tilt, rival ? 1.14 : 1);
  foot.poly([[-5,-4],[3,-4],[6,0],[12,2],[13,5],[-6,5],[-7,2]],C.leather,C.ink);
  foot.poly([[-3,-3],[2,-3],[4,1],[10,2],[10,3],[-3,2]],rival?C.steel:C.leatherLight);
  foot.line([-5,6],[12,6],C.ink,2);
  foot.line([2,1],[2,4],rival?C.silver:C.linenShadow);
  foot.line([6,2],[6,4],rival?C.steelLight:C.leatherMid);
}

function skirt(p, s, rival, time) {
  // Fold upward over bent thighs instead of hanging through the ground.
  const gather = clamp((OY-3-s.pelvis[1])/24,.22,1);
  const cloth = localPainter(p,s.pelvis,s.lean * .28,s.twist*(1+(1-gather)*.18),gather);
  const sway = Math.sin(time*6.7)*.9;
  cloth.poly([[-15,-2],[14,-2],[18+sway,18],[9,21],[-2,17],[-14,20],[-20+sway,14]],rival?C.navyDeep:C.linenDeep,C.ink);
  if (rival) {
    for (let i = 0; i < 6; i++) {
      const x = -16+i*5.6, tip = i%2 ? 19 : 23;
      cloth.poly([[x,-1],[x+5,-1],[x+6,tip-4],[x+2,tip],[x-1,tip-3]],i%2?C.tealShadow:C.steelDeep,C.ink);
      cloth.line([x+1,3],[x+2,tip-4],C.steelLight);
      cloth.dot(x+2,1,C.silver);
    }
  } else {
    cloth.poly([[-13,0],[-5,0],[-8+sway,16],[-16,17]],C.linen);
    cloth.poly([[-3,0],[4,0],[8+sway,18],[0,16]],C.linenLight);
    cloth.poly([[6,0],[13,0],[17+sway,16],[11,18]],C.linenShadow);
    cloth.line([-11,4],[-13,13],C.linenLight);
    cloth.line([0,3],[1,12],C.linenShadow);
    cloth.line([8,4],[12,14],C.linenDeep);
    for (let i = 0; i < 5; i++) {
      const x = -13+i*6;
      cloth.poly([[x,-3],[x+4,-3],[x+4,8],[x+2,10],[x,8]],C.leather,C.ink);
      cloth.dot(x+1,0,C.bronzeLight); cloth.line([x+1,3],[x+1,7],C.leatherLight);
    }
  }
}

function torso(p, s, rival) {
  const b = localPainter(p,s.pelvis,s.lean,s.twist,1);
  const top = -s.length;
  b.poly([[-6,top-7],[5,top-7],[7,top+5],[-7,top+6]],rival?C.steelDeep:C.skinShadow,C.ink);
  b.line([-3,top-5],[-2,top+1],rival?C.steelLight:C.skinLight,2);
  if (rival) {
    b.poly([[-19,top+1],[-9,top-2],[9,top-2],[20,top+4],[23,-18],[16,2],[-15,2],[-23,-17]],C.tealDeep,C.ink);
    b.poly([[-17,top+3],[-3,top+1],[-2,-8],[-14,-5],[-20,-20]],C.teal);
    b.poly([[0,top+1],[15,top+4],[19,-21],[12,-7],[1,-8]],C.tealShadow);
    b.poly([[-17,top+3],[-10,top+1],[-9,-25],[-17,-23]],C.tealLight);
    b.poly([[-17,-25],[-2,-21],[15,-24],[14,-17],[-1,-14],[-17,-18]],C.steelDeep,C.ink);
    b.line([-16,-25],[-2,-21],C.silver); b.line([-2,-21],[15,-24],C.steelLight);
    b.poly([[-15,-15],[-1,-11],[13,-14],[12,-7],[0,-4],[-14,-8]],C.tealShadow,C.ink);
    b.line([-13,-14],[-1,-10],C.tealHigh);
    b.line([0,top+5],[0,-24],C.steelLight,2);
    // Helmet collar and three interlocking silver gorget scales.
    for (let i=0;i<3;i++) b.poly([[-11,top-2+i*3],[0,top+2+i*3],[11,top-2+i*3],[8,top+3+i*3],[0,top+6+i*3],[-8,top+3+i*3]],i===0?C.silver:C.steel,C.ink);
    for (const x of [-15,13]) for (const y of [top+12,-18,-9]) b.dot(x,y,C.silver);
  } else {
    // 34 x 41 native-pixel muscle cuirass: raised pectorals, ribs, engraved rim.
    b.poly([[-15,top+1],[-7,top-1],[7,top-1],[16,top+3],[17,-21],[12,0],[-12,1],[-17,-20]],C.bronzeShadow,C.ink);
    b.poly([[-13,top+4],[-3,top+3],[-1,-25],[-10,-23],[-15,-28]],C.bronzeMid);
    b.poly([[1,top+3],[12,top+5],[15,-28],[10,-24],[2,-25]],C.bronze);
    b.poly([[-12,top+4],[-5,top+3],[-5,top+7],[-11,top+9]],C.gold);
    b.line([-14,-25],[-3,-22],C.bronzeDeep);
    b.line([2,-23],[13,-26],C.bronzeDeep);
    b.line([0,top+8],[0,-24],C.bronzeLight);
    for (let i=0;i<3;i++) {
      const y=-20+i*6;
      b.poly([[-9,y],[-2,y+1],[-2,y+5],[-9,y+4],[-11,y+2]],i===0?C.bronzeMid:C.bronze,C.bronzeDeep);
      b.poly([[1,y+1],[8,y],[10,y+3],[7,y+4],[1,y+5]],C.bronzeShadow,C.bronzeDeep);
      b.line([-8,y+1],[-4,y+2],C.bronzeLight);
    }
    b.line([-15,top+7],[-13,-23],C.bronzeLight);
    b.line([14,top+9],[13,-25],C.bronzeMid);
    b.line([-10,-3],[9,-3],C.bronzeLight);
    for (let x=-9;x<=9;x+=6) {
      b.line([x,-5],[x+3,-5],C.bronzeDeep); b.dot(x,-6,C.gold);
    }
  }
  // Back-bow strap crosses, rather than replacing, the armour's volume.
  if (!rival) {
    b.poly([[-13,top],[ -9,top], [12,-3],[8,-1]],C.leather,C.ink);
    b.line([-10,top+4],[8,-4],C.leatherLight);
    b.poly([[-7,-26],[-2,-29],[1,-24],[-4,-21]],C.bronzeLight,C.bronzeDeep);
    b.line([-5,-25],[-2,-26],C.ink);
  }
  b.poly([[-14,-3],[14,-3],[13,3],[-14,3]],C.leather,C.ink);
  b.line([-12,-2],[12,-2],rival?C.steel:C.leatherLight);
  b.poly([[-3,-3],[3,-3],[3,3],[-3,3]],rival?C.silver:C.bronzeLight,C.ink);
  b.dot(0,-1,C.leather,2);
  // Heavy, overlapping pauldrons versus the hero's small leather armhole trims.
  for (const side of [-1,1]) {
    const x=side*(s.width-3), y=top+5;
    if (rival) {
      b.poly([[x-9,y-3],[x-5,y-9],[x+4,y-10],[x+10,y-3],[x+9,y+8],[x-7,y+7]],C.steelDeep,C.ink);
      b.poly([[x-7,y-4],[x-3,y-8],[x+3,y-8],[x+7,y-3],[x+3,y+1],[x-6,y]],C.teal,C.ink);
      b.line([x-5,y-6],[x+2,y-7],C.silver,2);
      b.line([x-7,y+3],[x+7,y+4],C.steelLight);
    } else {
      b.poly([[x-4,y-4],[x+3,y-4],[x+5,y+2],[x-4,y+4]],C.leather,C.ink);
      b.line([x-2,y-3],[x+2,y-2],C.bronzeLight);
    }
  }
  b.poly([[-14,top-1],[-10,top-3],[-6,top+1],[-10,top+5]],rival?C.silver:C.bronzeMid,C.ink);
  b.dot(-11,top,C.glint);
}

function arm(p, shoulder, elbow, wrist, rival, far) {
  const skin = far ? [C.skinShadow,C.skin,C.skinMid] : [C.skin,C.skinMid,C.skinLight];
  const armour = [C.tealDeep,C.tealShadow,C.tealLight];
  tube(p,shoulder,elbow,rival?7.5:5.5,rival?5.5:4,rival?armour:skin);
  const e=localPainter(p,elbow);
  e.poly([[-4,-3],[2,-4],[5,0],[2,4],[-3,3]],rival?C.steel:C.skinShadow,C.ink);
  e.line([-2,-2],[1,-2],rival?C.silver:C.skinLight);
  tube(p,elbow,wrist,rival?5.8:4.4,3.3,rival?[C.steelDeep,C.steel,C.steelLight]:skin);
  if (!rival) {
    // A short exposed tendon remains between the elbow and fitted leather bracer.
    const a=point(elbow,wrist,.4), b=point(elbow,wrist,.89);
    tube(p,a,b,4.8,4,[C.leather,C.leatherMid,C.leatherLight]);
    const angle=Math.atan2(wrist[1]-elbow[1],wrist[0]-elbow[0]), n=[-Math.sin(angle),Math.cos(angle)];
    for(const t of [.46,.82]) {
      const h=point(elbow,wrist,t);
      p.line([h[0]-n[0]*4,h[1]-n[1]*4],[h[0]+n[0]*4,h[1]+n[1]*4],C.bronzeMid);
    }
    p.line(point(elbow,wrist,.13),point(elbow,wrist,.31),C.skinHigh);
  } else {
    const a=point(elbow,wrist,.58);
    p.line([a[0]-3,a[1]],[a[0]+3,a[1]],C.tealHigh);
  }
}
function hand(p, at, angle, rival, open = false) {
  const h=localPainter(p,at,angle);
  h.poly([[-4,-3],[2,-4],[5,-1],[4,4],[-2,5],[-5,2]],rival?C.steelDeep:C.skinShadow,C.ink);
  h.poly([[-3,-2],[1,-3],[3,-1],[2,3],[-2,3]],rival?C.steelLight:C.skinMid);
  // Three separate knuckle/finger highlights and a hooked thumb.
  for(let i=0;i<3;i++) {
    h.line([-2+i*2,-2],[-2+i*2,open?-6:0],rival?C.silver:C.skinLight);
    h.dot(-2+i*2,1,rival?C.steel:C.skinShadow);
  }
  h.line([3,0],[4,2],rival?C.silver:C.skinHigh);
  h.dot(-2,3,rival?C.steel:C.skin);
}

function face(p, s, rival, pose) {
  const f=localPainter(p,s.head,s.headAngle,rival?1:22/23,rival?1:23/25);
  if(rival) {
    // Closed Corinthian-like sentinel helm, NO skin/eyes copied from the hero.
    f.poly([[-12,-9],[-8,-15],[4,-16],[11,-10],[13,2],[9,13],[4,16],[-5,13],[-12,5]],C.steelDeep,C.ink);
    f.poly([[-10,-8],[-7,-13],[0,-14],[0,-4],[-9,-1]],C.teal);
    f.poly([[1,-14],[5,-14],[10,-9],[11,-3],[2,-5]],C.steelLight);
    f.poly([[-10,0],[0,-3],[10,-1],[10,5],[3,12],[-6,8]],C.ink);
    f.poly([[-11,-1],[-6,-3],[-4,2],[-4,11],[-8,10],[-11,5]],C.tealLight,C.ink);
    f.poly([[7,-3],[12,-1],[11,7],[6,13],[3,11],[5,4]],C.steel,C.ink);
    f.poly([[0,-5],[3,-5],[4,9],[1,12],[-1,8]],C.silver,C.steelDeep);
    f.line([-8,-7],[8,-8],C.silver);
    f.line([-7,-13],[-3,-14],C.tealHigh);
    f.line([-9,1],[-7,7],C.tealHigh);
    f.line([10,1],[8,7],C.silver);
    f.line([-4,1],[-1,0],C.edge); f.line([4,0],[7,1],C.edge);
    f.poly([[-4,-15],[-2,-19],[2,-19],[4,-16],[2,-6],[-1,-6]],C.tealDeep,C.ink);
    f.line([0,-17],[1,-8],C.tealHigh);
    for(const x of [-9,9]) f.dot(x,-5,C.glint);
  } else {
    const strain=['parry','slash','thrust','uppercut','airSlash','overhead','spin','dash'].includes(pose);
    const hurt=['recoil','airHurt','kneel'].includes(pose);
    f.poly([[-10,-7],[-6,-12],[3,-12],[8,-8],[9,-1],[11,1],[10,4],[7,5],[6,9],[1,11],[-6,9],[-9,4],[-11,0]],C.skinShadow,C.ink);
    f.poly([[-5,-8],[3,-9],[7,-6],[7,-1],[9,2],[6,4],[5,8],[-1,8],[-5,3]],C.skinMid);
    f.poly([[-3,-7],[3,-7],[5,-5],[4,-2],[-3,-3]],C.skinLight);
    f.poly([[1,1],[5,0],[6,3],[3,5],[0,3]],C.skin);
    f.line([7,-2],[8,1],C.skinHigh); f.dot(10,2,C.skinLight);
    f.poly([[-11,-6],[-9,-10],[-5,-13],[2,-13],[7,-10],[8,-6],[4,-7],[1,-9],[-3,-6],[-7,-5],[-7,1],[-10,1]],C.hair,C.ink);
    f.poly([[-8,-9],[-4,-11],[1,-11],[3,-9],[-2,-10],[-5,-7]],C.hairMid);
    f.line([-7,-9],[-4,-10],C.hairLight); f.dot(3,-10,C.hairLight);
    f.line([-9,-3],[-8,1],C.beard); f.dot(-8,-4,C.beardLight);
    f.poly([[-10,0],[-7,-1],[-6,2],[-8,4],[-10,3]],C.skin,C.ink);
    f.line([-9,1],[-8,2],C.skinLight);
    f.line([-3,-2],[0,strain?-1:-2],C.hair);
    f.line([3,strain?-2:-3],[7,-3],C.hair, strain?2:1);
    f.dot(-1,0,C.skinDeep); f.line([4,-1],[6,-1],hurt?C.skinDeep:C.linenLight);
    if(!hurt) f.dot(6,-1,C.ink);
    f.line([1,-5],[5,-5],C.skin); f.dot(2,-4,C.skinHigh);
    // Salt-and-pepper SHORT beard follows the jaw, not a giant wizard beard.
    f.poly([[-6,4],[-3,6],[2,6],[5,4],[7,4],[6,9],[2,11],[-4,9],[-7,6]],C.hairLight,C.ink);
    f.poly([[-4,6],[-1,8],[3,8],[5,6],[5,9],[1,10],[-3,8]],C.beard);
    f.line([-2,5],[3,5],C.hair); f.line([1,7],[4,6],hurt?C.ink:C.skinDeep);
    for(const [x,y] of [[-5,5],[-4,7],[-1,9],[2,9],[5,5]]) f.dot(x,y,C.beardLight);
    f.dot(0,3,C.skinHigh);
  }
}

function shield(p, at, rival, angle = 0, back = false) {
  const f=localPainter(p,[at[0]+(back?0:3),at[1]],angle,back?.8:1,1);
  if(rival) {
    f.poly([[-13,-20],[-7,-24],[9,-22],[16,-15],[14,12],[5,25],[-9,15],[-15,-5]],C.steelDeep,C.ink);
    f.poly([[-11,-19],[-6,-21],[8,-19],[13,-13],[11,11],[4,21],[-6,13],[-12,-4]],C.steelLight,C.ink);
    f.poly([[-8,-16],[-4,-18],[6,-16],[10,-11],[8,10],[3,17],[-4,11],[-9,-4]],C.tealDeep,C.ink);
    f.poly([[-7,-14],[-2,-16],[-1,13],[-4,10],[-8,-3]],C.teal);
    f.poly([[0,-15],[6,-13],[8,-9],[6,8],[2,13]],C.tealShadow);
    f.line([0,-16],[1,14],C.steel,2);
    f.poly([[-5,-3],[0,-8],[6,-2],[1,4]],C.steel,C.ink);
    f.line([-3,-3],[0,-6],C.silver);
    for(const [x,y] of [[-10,-15],[9,-14],[-10,2],[9,4],[4,17]]) f.dot(x,y,C.glint);
  } else {
    f.poly([[-13,-11],[-7,-17],[4,-18],[12,-13],[16,-4],[15,8],[8,16],[-3,18],[-12,11],[-16,0]],C.bronzeDeep,C.ink);
    f.poly([[-12,-9],[-6,-15],[4,-16],[10,-11],[14,-3],[13,7],[7,14],[-3,16],[-10,10],[-14,0]],C.bronzeLight);
    f.poly([[-9,-8],[-5,-12],[3,-13],[9,-9],[11,-2],[10,6],[6,11],[-3,13],[-9,7],[-11,0]],back?C.leather:C.bronzeShadow,C.ink);
    f.poly([[-9,-7],[-4,-11],[1,-11],[0,11],[-6,9],[-10,2]],back?C.leatherMid:C.bronze);
    // Engraved stepped wave, deliberately not an animated halo.
    for(const [x,y] of [[-8,-8],[4,-9],[-8,6],[4,8]]) {
      f.line([x,y],[x+3,y],C.bronzeMid); f.line([x+3,y],[x+3,y+3],C.bronzeMid);
    }
    f.poly([[-5,-3],[-1,-6],[4,-4],[6,1],[2,5],[-3,4]],C.bronzeMid,C.bronzeDeep);
    f.poly([[-3,-3],[-1,-4],[2,-3],[1,0],[-3,1]],C.gold);
    f.line([-11,-10],[-7,-14],C.glint); f.line([11,7],[7,12],C.bronze);
    for(const [x,y] of [[-12,0],[0,-15],[12,0],[0,15]]) f.dot(x,y,C.gold);
  }
  if(!back) {
    // Wrist and visible knuckles physically straddle the central grip/boss.
    f.line([-6,2],[-1,4],C.leather,3);
    for(let i=0;i<3;i++) f.dot(-5+i*2,2,rival?C.silver:C.skinLight);
  }
}

function bowGeometry(at, pull) {
  const x=at[0],y=at[1], bend=pull*7;
  return [[x-3-bend,y-34+pull*3],[x+6-bend*.5,y-28],[x+12,y-17],[x+8,y-4],
    [x+3,y],[x+8,y+4],[x+12,y+17],[x+6-bend*.5,y+28],[x-3-bend,y+34-pull*3]];
}
function bow(p, at, drawHand, pull, releasePhase, stored = false, angle = 0) {
  let vertices=bowGeometry(at,pull);
  if(stored) {
    const co=Math.cos(angle),si=Math.sin(angle);
    vertices=vertices.map(([x,y])=>[at[0]+(x-at[0])*co-(y-at[1])*si,at[1]+(x-at[0])*si+(y-at[1])*co]);
  }
  // Composite wood limbs: a dark 4px silhouette, warm belly and horn nocks.
  for(let i=0;i<vertices.length-1;i++) p.line(vertices[i],vertices[i+1],C.ink,4);
  for(let i=0;i<vertices.length-1;i++) p.line(vertices[i],vertices[i+1],C.leatherLight,2);
  for(const i of [0,1,6,7]) p.line(vertices[i],vertices[i+1],C.bronzeMid);
  p.line(vertices[3],vertices[5],C.leather,3);
  const top=vertices[0],bottom=vertices.at(-1);
  let stringHand=drawHand;
  if(stored || releasePhase !== null) {
    const rest=point(top,bottom,.5);
    // Phase-based empty-string snap; no arrow, projectile or time-based arm motion.
    const snap=releasePhase===null?0:(releasePhase<.12?lerp(drawHand[0]-rest[0],4,releasePhase/.12):releasePhase<.25?lerp(4,-2,(releasePhase-.12)/.13):releasePhase<.4?lerp(-2,0,(releasePhase-.25)/.15):0);
    stringHand=[rest[0]+snap,releasePhase!==null&&releasePhase<.12?lerp(drawHand[1],rest[1],releasePhase/.12):rest[1]];
  }
  p.line(top,stringHand,C.linenShadow);
  p.line(stringHand,bottom,C.linenShadow);
  for(const tip of [top,bottom]) p.dot(tip[0],tip[1],C.linenLight,2);
  return top;
}

function sword(p, at, angle, rival) {
  const d=[Math.cos(angle),Math.sin(angle)], n=[-d[1],d[0]];
  const length=rival?lerp(69,44,Math.abs(d[1])):44;
  const q=(along,across=0)=>[at[0]+d[0]*along+n[0]*across,at[1]+d[1]*along+n[1]*across];
  const tip=q(length);
  if(rival) {
    // Long ash shaft, rear ferrule, broad silver leaf point. Vertical projection
    // is foreshortened: a deliberate thrust-plane turn, not boundary clipping.
    p.line(q(-24),q(length-17),C.ink,4);
    p.line(q(-23),q(length-17),C.leatherMid,2);
    p.line(q(-21,-1),q(length-20,-1),C.leatherLight);
    p.line(q(-24),q(-19),C.steelLight,3);
    p.poly([q(length-24,-3),q(length-13,-6),tip,q(length-13,5),q(length-24,3)],C.steel,C.ink);
    p.poly([q(length-22,-2),q(length-13,-4),tip,q(length-14,0)],C.silver);
    p.line(q(length-22),q(length-2),C.tealLight);
    p.line(q(length-26,-4),q(length-26,4),C.bronzeLight,2);
    for(let i=-3;i<=9;i+=3) p.line(q(i,-1),q(i,1),C.navyLight);
  } else {
    p.line(q(-10),q(7),C.ink,5);
    p.line(q(-8),q(6),C.leatherMid,3);
    for(const i of [-6,-2,2]) p.line(q(i,-1),q(i,1),C.leatherLight);
    p.poly([q(7,-3),q(29,-4),q(37,-2),tip,q(36,3),q(12,3)],C.steel,C.ink);
    p.poly([q(9,-2),q(28,-3),q(39,-1),tip,q(12,0)],C.silver);
    p.line(q(11,1),q(34,1),C.steelDeep);
    p.line(q(6,-8),q(6,8),C.ink,3);
    p.line(q(6,-7),q(6,7),C.bronzeLight);
    p.dot(...q(-10),C.bronzeLight,2);
    p.line(q(13,-2),q(20,-2),C.glint);
  }
  // Endpoint ink and metadata share the SAME integer pixel (also when mirrored).
  p.dot(...tip,C.silver);
  return tip;
}

function signature(identity, values, mode, facing) {
  let hash=2166136261;
  for(const v of values) { hash^=Math.round(v*8); hash=Math.imul(hash,16777619); }
  return `${identity}:${mode}:${facing}:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

/**
 * @param {'hero'|'rival'} identity
 * @returns {{canvas:HTMLCanvasElement,width:number,height:number,pixelsPerUnit:number,
 * origin:{x:number,y:number},draw:Function}}
 */
export function createFighterSprite(identity = 'hero') {
  if(identity!=='hero' && identity!=='rival') throw new RangeError(`Unknown fighter: ${identity}`);
  const rival=identity==='rival';
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx) throw new Error('A transparent Canvas 2D context is required.');
  const image=ctx.createImageData(W,H), pixels=new Pixels();
  const a=new Float32Array(CHANNELS), b=new Float32Array(CHANNELS), mixed=new Float32Array(CHANNELS);
  // Build all interpolation tables once per identity, outside the hot draw path.
  for(const name of Object.keys(HERO)) tableFor(identity,name);
  function draw(actorState = {}, time = 0, {ghost = false} = {}) {
    const state=actorState || {};
    const pose=Object.hasOwn(HERO,state.pose)?state.pose:'idle';
    const nextPose=Object.hasOwn(HERO,state.nextPose)?state.nextPose:pose;
    const phase=clamp(finite(state.phase)), nextPhase=clamp(finite(state.nextPhase,phase));
    const blend=clamp(finite(state.blend)), facing=finite(state.facing,1)<0?-1:1;
    readPose(identity,pose,phase,a); readPose(identity,nextPose,nextPhase,b);
    // Unwrapped angles retain authored full spins. Only cross-pose transitions
    // choose the nearest equivalent orientation, avoiding an accidental extra turn.
    const turnDelta=((b[20]-a[20]+180)%360+360)%360-180;
    for(let j=0;j<CHANNELS;j++) mixed[j]=j===20?a[j]+turnDelta*blend:lerp(a[j],b[j],blend);
    const active=blend<.5?pose:nextPose;
    const activePhase=blend<.5?phase:nextPhase;
    const bowPose=name=>name==='bow'||name==='release';
    const bowWeight=lerp(bowPose(pose)?1:0,bowPose(nextPose)?1:0,blend);
    const s=skeleton(mixed,rival,rival?0:bowWeight);
    const mode=rival&&state.disarmed?'none':!rival&&bowWeight>=.5?'bow':rival?'spear':'sword';
    const clock=finite(time), speed=finite(state.velocity);
    pixels.clear();
    cape(pixels,s,rival,active,clock,speed);
    if(!rival) {
      if(mode==='bow') {
        shield(pixels,s.at(-17,-22),false,-.18,true);
        const scabbard=s.at(-13,-1);
        tube(pixels,scabbard,[scabbard[0]-17,scabbard[1]+25],3,2,[C.leather,C.leatherMid,C.bronzeMid]);
        pixels.line([scabbard[0]-5,scabbard[1]-3],[scabbard[0]+4,scabbard[1]+2],C.bronzeLight,2);
      } else bow(pixels,s.at(-15,-25),null,0,null,true,s.lean-.34);
    }
    leg(pixels,s,rival,false);
    leg(pixels,s,rival,true);
    arm(pixels,s.offShoulder,s.offElbow,s.offHand,rival,true);
    skirt(pixels,s,rival,clock);
    torso(pixels,s,rival);
    face(pixels,s,rival,active);
    arm(pixels,s.shoulder,s.elbow,s.hand,rival,false);
    let weaponTip;
    if(mode==='bow') {
      const release=active==='release'?activePhase:null;
      const pull=release!==null?Math.max(0,1-release*4):clamp((s.offHand[0]-s.hand[0])/51);
      weaponTip=bow(pixels,s.offHand,s.hand,pull,release);
      hand(pixels,s.offHand,Math.PI/2,false);
      hand(pixels,s.hand,0,false,release!==null&&release>.08);
    } else {
      shield(pixels,s.offHand,rival,clamp(s.lean*.36,-.3,.4));
      weaponTip=mode==='none'?[...s.hand]:sword(pixels,s.hand,s.weaponAngle,rival);
      hand(pixels,s.hand,s.weaponAngle,rival,mode==='none');
    }
    const reflect=v=>[facing<0?2*OX-Math.round(v[0]):Math.round(v[0]),Math.round(v[1])];
    // putImageData is unaffected by transforms/alpha, but reset the context as
    // well, including clipping, composite mode and external save/restore stacks.
    if(canvas.width!==W||canvas.height!==H) {canvas.width=W;canvas.height=H;}
    if(typeof ctx.reset==='function') ctx.reset(); else canvas.width=W;
    ctx.imageSmoothingEnabled=false;
    image.data.fill(0);
    const alpha=ghost?88:255;
    for(let y=pixels.y0;y<=pixels.y1;y++) for(let x=pixels.x0;x<=pixels.x1;x++) {
      const ink=pixels.data[y*W+x]; if(!ink) continue;
      const rx=facing<0?2*OX-x:x; if(rx<0||rx>=W) continue;
      const offset=(y*W+rx)*4, rgb=RGBA[ink];
      image.data[offset]=rgb[0]; image.data[offset+1]=rgb[1]; image.data[offset+2]=rgb[2]; image.data[offset+3]=alpha;
    }
    ctx.putImageData(image,0,0);
    const bounds={x:facing<0?2*OX-pixels.x1:pixels.x0,y:pixels.y0,width:pixels.x1-pixels.x0+1,height:pixels.y1-pixels.y0+1};
    return {
      identity,pose,phase,nextPose,nextPhase,blend,weapon:mode,weaponHidden:mode==='none',
      hand:reflect(s.hand),offHand:reflect(s.offHand),weaponTip:reflect(weaponTip),head:reflect(s.head),bounds,
      poseSignature:signature(identity,mixed,mode,facing),
      // Extra observable joints make renderer attachments and offline QA explicit.
      joints:{pelvis:reflect(s.pelvis),neck:reflect(s.neck),shoulder:reflect(s.shoulder),elbow:reflect(s.elbow),
        offShoulder:reflect(s.offShoulder),offElbow:reflect(s.offElbow),farKnee:reflect(s.farKnee),nearKnee:reflect(s.nearKnee),
        farAnkle:reflect(s.farAnkle),nearAnkle:reflect(s.nearAnkle)},
    };
  }
  return {canvas,width:W,height:H,pixelsPerUnit:48,origin:{x:OX,y:OY},draw};
}