import * as THREE from 'three';

// Original, procedural western set dressing. No image/network dependencies.
export function seededRandom(seed = 1899) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = v => { const q = clamp(v); return q * q * (3 - 2 * q); };

export function createWesternEnvironment() {
  const random = seededRandom(18991006);
  const geometries = new Set(), materials = new Set(), textures = new Set(), instanceMeshes = new Set();
  const ownGeometry = g => { geometries.add(g); return g; };
  const ownMaterial = m => { materials.add(m); return m; };
  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitPlane = ownGeometry(new THREE.PlaneGeometry(1, 1));
  const rockGeometry = ownGeometry(new THREE.IcosahedronGeometry(1, 2));
  const rockPositions = rockGeometry.attributes.position;
  for (let i = 0; i < rockPositions.count; i++) {
    const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
    const weathering = 1 + .10 * Math.sin(x * 9 + z * 4) * Math.cos(y * 7 - z * 5);
    rockPositions.setXYZ(i, x * weathering, y * (.86 + .09 * Math.cos(x * 5 + z * 6)), z * weathering);
  }
  rockGeometry.computeVertexNormals();
  // PolyhedronGeometry is non-indexed. Weld its lighting normals (including UV seams)
  // without welding UVs, so weathered stones do not become dozens of flat triangles.
  const rockNormals = rockGeometry.attributes.normal, normalSums = new Map(), normalKeys = [];
  for (let i = 0; i < rockPositions.count; i++) {
    const key = [rockPositions.getX(i), rockPositions.getY(i), rockPositions.getZ(i)].map(v => Math.round(v * 100000)).join(',');
    normalKeys.push(key);
    if (!normalSums.has(key)) normalSums.set(key, new THREE.Vector3());
    normalSums.get(key).add(new THREE.Vector3(rockNormals.getX(i), rockNormals.getY(i), rockNormals.getZ(i)));
  }
  for (const normal of normalSums.values()) normal.normalize();
  for (let i = 0; i < rockNormals.count; i++) {
    const normal = normalSums.get(normalKeys[i]); rockNormals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const trunkGeometry = ownGeometry(new THREE.CylinderGeometry(.65, 1, 1, 9));
  const wheelGeometry = ownGeometry(new THREE.TorusGeometry(.66, .075, 6, 24));
  const tireGeometry = ownGeometry(new THREE.TorusGeometry(.713, .027, 5, 24));
  const hubGeometry = ownGeometry(new THREE.CylinderGeometry(.13, .13, .23, 10));
  const rollGeometry = ownGeometry(new THREE.CylinderGeometry(.18, .18, 1.25, 12));
  const dummy = new THREE.Object3D();
  // Art streams never depend on animation time or consume the placement stream.
  const artRandom = seededRandom(18991006);

  function canvasTexture(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('HD-2D 环境纹理需要离屏 Canvas 2D。');
    ctx.imageSmoothingEnabled = false;
    paint(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  }

  const earth = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#d2c2a5'; c.fillRect(0, 0, w, h);
    const colors = ['#c6b69b', '#ddceb4', '#beaf95', '#e2d3ba'];
    // Low-contrast mineral grains, not a screen-space checkerboard.
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = colors[i % colors.length];
      c.fillRect(Math.floor(artRandom() * w), Math.floor(artRandom() * h), 2 + Math.floor(artRandom() * 4), 1 + i % 2);
    }
  });
  earth.wrapS = earth.wrapT = THREE.RepeatWrapping;
  earth.repeat.set(24, 24);
  const woodTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c3a078'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 24) {
      c.fillStyle = y % 48 ? '#b99a77' : '#cfb18a'; c.fillRect(0, y, w, 23);
      c.fillStyle = '#745b46'; c.fillRect(0, y + 23, w, 1);
      c.fillStyle = '#e1c29a'; c.fillRect(0, y + 1, w, 1);
      for (const x of [5, w - 7]) {
        c.fillStyle = '#62574b'; c.fillRect(x, y + 5, 2, 2); c.fillRect(x, y + 17, 2, 2);
      }
    }
    for (let i = 0; i < 200; i++) {
      c.fillStyle = i % 3 ? '#ab8c69' : '#d9ba92';
      c.fillRect(Math.floor(artRandom() * w), Math.floor(artRandom() * h), 3 + Math.floor(artRandom() * 26), 1);
    }
    for (const [x, y] of [[32, 12], [91, 59], [57, 106]]) {
      c.strokeStyle = '#87694e'; c.lineWidth = 1; c.beginPath();
      c.moveTo(x - 12, y); c.lineTo(x - 4, y - 3); c.lineTo(x + 5, y - 2);
      c.lineTo(x + 11, y); c.lineTo(x + 3, y + 3); c.lineTo(x - 5, y + 2); c.closePath(); c.stroke();
      c.fillStyle = '#705642'; c.fillRect(x - 2, y, 4, 1);
    }
  });
  const clothTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#eadcc0'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const fold = Math.sin(x * .19) * .5 + Math.sin(x * .067 + 1) * .5;
      c.fillStyle = fold > .3 ? '#f0e5cd' : fold < -.4 ? '#cabea5' : '#ded0b5';
      c.fillRect(x, 0, 1, h);
    }
    c.fillStyle = '#ded2ba';
    for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1);
    for (const x of [4, 62, 122]) {
      c.fillStyle = '#9d8b70'; c.fillRect(x, 0, 1, h);
      for (let y = 2; y < h; y += 5) { c.fillStyle = '#f5ebd5'; c.fillRect(x + 2, y, 2, 2); }
    }
    c.fillStyle = '#b8a78c'; c.fillRect(86, 83, 16, 12);
    c.strokeStyle = '#dcc9a9'; c.strokeRect(87.5, 84.5, 13, 9);
  });
  const mapTexture = canvasTexture(128, 96, (c, w, h) => {
    c.fillStyle = '#dbbd81'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#98744c'; c.lineWidth = 1;
    for (let k = 0; k < 8; k++) {
      c.beginPath();
      for (let x = 0; x < w; x += 3) {
        const y = 10 + k * 10 + Math.sin(x * .075 + k) * 6;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = '#547476'; c.lineWidth = 3; c.beginPath();
    c.moveTo(22, 0); c.lineTo(36, 24); c.lineTo(30, 46); c.lineTo(66, 74); c.lineTo(63, 96); c.stroke();
    c.fillStyle = '#865438';
    for (let i = 0; i < 12; i++) c.fillRect(43 + i * 5, 68 - i * 4, 2, 2);
    c.strokeStyle = '#784c32'; c.strokeRect(4, 4, 120, 88);
    c.fillRect(98, 18, 3, 9); c.fillRect(95, 21, 9, 3);
  });
  // Preserve the original paper's half-atlas sampling; no mip can mix the two leaves.
  mapTexture.minFilter = THREE.NearestFilter; mapTexture.generateMipmaps = false; mapTexture.anisotropy = 1;
  function strokePixels(c, points, color, width = 1) {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    points.forEach(([x, y], i) => { if (i === 0) c.moveTo(Math.round(x), Math.round(y)); else c.lineTo(Math.round(x), Math.round(y)); });
    c.stroke();
  }
  const grassTexture = canvasTexture(64, 64, c => {
    const tones = ['#cbb68b', '#ded0a3', '#b6af83', '#a49773'];
    for (let i = 0; i < 23; i++) {
      const base = 23 + artRandom() * 17, tip = 6 + artRandom() * 51, y = 9 + artRandom() * 31;
      strokePixels(c, [[base, 60], [(base + tip) / 2, y + 16], [tip, y]], tones[i % 4], i % 4 === 0 ? 2 : 1);
      if (i % 4 === 0) {
        c.fillStyle = '#e7d5aa';
        for (let k = 0; k < 4; k++) c.fillRect(Math.round(tip) + k % 2, Math.round(y) + k * 3, 2, 2);
      }
    }
  });
  // Four separate padded RGBA sheets: no atlas neighbour can bleed into the needles.
  const treeTextures = Array.from({length: 4}, (_, variant) => {
    const rng = seededRandom(18991006 + variant * 971);
    return canvasTexture(96, 160, c => {
      c.save(); c.beginPath(); c.rect(4, 4, 88, 152); c.clip();
      const lean = [1, -7, 5, 10][variant], stem = y => 48 + lean * (1 - y / 154);
      strokePixels(c, [[48, 155], [stem(86), 86], [stem(9), 9]], '#76604a', 4);
      strokePixels(c, [[47, 153], [stem(83) - 1, 83], [stem(11) - 1, 11]], '#b3976d', 1);
      const tiers = [13, 16, 12, 14][variant];
      for (let level = 0; level < tiers; level++) {
        const t = level / (tiers - 1), y = 18 + t * (variant === 2 ? 103 : 113);
        const spread = (5 + 32 * Math.pow(Math.sin(t * 1.35), .8)) * (variant === 1 ? .78 : 1);
        for (const side of [-1, 1]) {
          // Missing boughs, off-axis tips and separated clumps break the Christmas-tree outline.
          if ((level > 7 && rng() < .22) || (variant === 2 && level < 2)) continue;
          const length = spread * (.58 + rng() * .43) * (side === 1 && variant === 3 ? .63 : 1);
          const tipX = stem(y) + side * length, tipY = y + 4 + rng() * 9;
          strokePixels(c, [[stem(y), y], [stem(y) + side * length * .53, tipY + 2], [tipX, tipY - 3]], '#826b4e', 2);
          for (let k = 0; k < 6; k++) {
            const f = (k + .5) / 6, cx = stem(y) + side * length * f, cy = y + (tipY - y) * f;
            const radius = 3 + rng() * 4;
            strokePixels(c, [[cx - side * 3, cy + 2], [cx, cy - radius], [cx + side * 4, cy - 2]], '#607565', 2);
            for (let n = 0; n < 17; n++) {
              const dx = (rng() - .5) * radius * 2.4, dy = (rng() - .5) * radius;
              c.fillStyle = ['#526a5d', '#698371', '#82927a', '#a4ad89', '#bcc09a'][dy < -1 ? 3 + n % 2 : n % 3];
              c.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1 + n % 3, 1 + n % 2);
            }
          }
        }
      }
      for (let i = 0; i < 4; i++) {
        const y = 132 + i * 5, side = i % 2 ? 1 : -1;
        strokePixels(c, [[stem(y), y], [stem(y) + side * (9 + rng() * 9), y + 2], [stem(y) + side * 20, y - 3]], '#927858', 1);
      }
      c.restore();
    });
  });
  const scrubTexture = canvasTexture(64, 64, c => {
    for (let i = 0; i < 24; i++) {
      const x = 6 + artRandom() * 52, y = 15 + artRandom() * 34;
      strokePixels(c, [[31, 61], [x * .65 + 11, y + 8], [x, y]], '#9b8766');
      for (let k = 0; k < 6; k++) {
        c.fillStyle = ['#a4ad90', '#c0bd94', '#d3c7a1'][k % 3];
        c.fillRect(Math.round(x + (artRandom() - .5) * 10), Math.round(y + (artRandom() - .5) * 9), 3, 2);
      }
    }
  });
  const flowerTexture = canvasTexture(32, 48, c => {
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 5, y = 10 + Math.floor(artRandom() * 16);
      strokePixels(c, [[16, 45], [x, y]], '#9a9e79');
      c.fillStyle = i % 2 ? '#d6c5ae' : '#e2d5ac';
      c.fillRect(x - 2, y, 5, 2); c.fillRect(x, y - 2, 2, 5);
      c.fillStyle = '#b59664'; c.fillRect(x, y, 1, 1);
    }
  });
  const litterTexture = canvasTexture(64, 64, c => {
    for (let i = 0; i < 55; i++) {
      const x = 6 + artRandom() * 49, y = 6 + artRandom() * 49;
      strokePixels(c, [[x, y], [x + 3, y - 2], [x + 6, y - 1]], i % 3 ? '#b39a71' : '#d7c19a');
      if (i % 7 === 0) { c.fillStyle = '#987c59'; c.fillRect(Math.round(x), Math.round(y), 4, 2); }
    }
  });
  const barkTexture = canvasTexture(64, 128, (c, w, h) => {
    c.fillStyle = '#a28766'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) {
      const x = Math.floor(artRandom() * w), y = Math.floor(artRandom() * h);
      c.fillStyle = ['#715e4c', '#c1a27b', '#8c755a'][i % 3];
      c.fillRect(x, y, 1 + i % 3, 4 + Math.floor(artRandom() * 22));
    }
  });
  const rockTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c7bcb1'; c.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 13) {
      const points = [];
      for (let x = 0; x <= w; x += 4) points.push([x, y + Math.sin(x * .055 + y) * 3]);
      strokePixels(c, points, y % 2 ? '#b1a69b' : '#ddd0bd', 2);
    }
    for (let i = 0; i < 520; i++) {
      c.fillStyle = ['#afa59c', '#e2d8c8', '#c0b1a3'][i % 3];
      c.fillRect(Math.floor(artRandom() * w), Math.floor(artRandom() * h), 1 + i % 3, 1);
    }
  });

  function standard(color, options = {}) {
    return ownMaterial(new THREE.MeshStandardMaterial({color, roughness: .96, metalness: 0, ...options}));
  }
  const wood = standard('#d6b992', {map: woodTexture});
  const paleWood = standard('#efddba', {map: woodTexture});
  const darkWood = standard('#92765a', {map: woodTexture});
  const cloth = standard('#fff0d3', {map: clothTexture, side: THREE.DoubleSide});
  const blueCloth = standard('#9ba9a3', {map: clothTexture, side: THREE.DoubleSide});
  const metal = standard('#424b4a', {metalness: .42, roughness: .67});
  const ropeMaterial = standard('#d7c29e');
  const stone = standard('#eee0d1', {map: rockTexture});
  const bark = standard('#c3ae8c', {map: barkTexture});
  const cutoutShadows = new Map();
  function cutout(map, color = '#ffffff', alphaTest = .34) {
    const material = standard(color, {map, alphaTest, side: THREE.DoubleSide});
    material.shadowSide = THREE.DoubleSide;
    // Directional/spot depth AND point-light distance passes use the same alpha discard.
    cutoutShadows.set(material, {
      depth: ownMaterial(new THREE.MeshDepthMaterial({map, alphaTest, side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking})),
      distance: ownMaterial(new THREE.MeshDistanceMaterial({map, alphaTest, side: THREE.DoubleSide})),
    });
    return material;
  }
  const pineMaterials = treeTextures.map(map => cutout(map));
  const grassMaterial = cutout(grassTexture, '#fff2d2', .30);
  const scrubMaterial = cutout(scrubTexture, '#f5ead1');
  const flowerMaterial = cutout(flowerTexture);
  const litterMaterial = cutout(litterTexture, '#f1dfc0');
  const groundMaterial = standard('#ffffff', {map: earth, vertexColors: true});
  const roadTexture = earth.clone(); roadTexture.repeat.set(1, 12); textures.add(roadTexture);
  const roadMaterial = standard('#dac29e', {map: roadTexture});
  const mapMaterial = standard('#fff1d0', {map: mapTexture, side: THREE.DoubleSide});
  const lanternMaterial = standard('#ffcc75', {emissive: '#ffa046', emissiveIntensity: 2.1});

  function mesh(group, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, shadow = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = shadow; object.receiveShadow = true;
    applyCutoutShadow(object, material);
    group.add(object); return object;
  }
  function applyCutoutShadow(object, material) {
    const shadow = cutoutShadows.get(material);
    if (shadow) { object.customDepthMaterial = shadow.depth; object.customDistanceMaterial = shadow.distance; }
  }
  const box = (group, material, x, y, z, sx, sy, sz) => mesh(group, unitBox, material, x, y, z, sx, sy, sz);
  function beam(group, a, b, thickness = .12, material = wood) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const object = box(group, material, 0, 0, 0, thickness, start.distanceTo(end), thickness);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return object;
  }

  function heightAt(kind, x, z) {
    const distant = smooth((Math.hypot(x * .8, z * .65) - 24) / 36);
    let y = distant * (1.6 + Math.sin(x * .08) * 2.1 + Math.cos(z * .065) * 1.4);
    if (kind === 'valley') {
      const river = -26 + Math.sin(z * .028) * 6;
      const bank = smooth((Math.abs(x - river) - 5) / 5);
      y = -2.65 * (1 - bank) + y * bank;
    }
    if (kind === 'crossing') {
      const bank = smooth((Math.abs(z + 5) - 5.8) / 2.2);
      y = -2.9 * (1 - bank) + y * bank;
    }
    return y;
  }

  function terrain(group, kind) {
    const geometry = ownGeometry(new THREE.PlaneGeometry(340, 340, 224, 224));
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, -65);
    const p = geometry.attributes.position, colors = [];
    const color = new THREE.Color(), dry = new THREE.Color('#eddec0'), sage = new THREE.Color('#c7c5a5');
    const dust = new THREE.Color('#d8bd97'), sediment = new THREE.Color('#b6aaa0');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = heightAt(kind, x, z);
      p.setY(i, y);
      const patch = clamp(.40 + .24 * Math.sin(x * .105 + Math.cos(z * .073)) + .19 * Math.cos(z * .13 - x * .043));
      color.copy(dry).lerp(sage, patch * .58);
      const road = 1 - smooth((Math.abs(x - Math.sin(z * .044) * 2.2) - 2.1) / 2.5);
      color.lerp(dust, road * .75);
      if (y < -.4) color.lerp(sediment, smooth((-y - .4) / 2.1) * .8);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    mesh(group, geometry, groundMaterial, 0, 0, 0, 1, 1, 1, false);
    // A closed, continuous terrain sheet. The river bed is lowered, never deleted.
    if (kind !== 'crossing') {
      const positions = [], uv = [], indices = [];
      for (let i = 0; i <= 96; i++) {
        const z = 24 - i * 1.35, center = Math.sin(z * .044) * 2.2;
        for (const side of [-1, 1]) {
          const x = center + side * (kind === 'trail' ? 2.25 : 1.65);
          positions.push(x, heightAt(kind, x, z) + .046, z); uv.push((side + 1) / 2, i / 96);
        }
        if (i < 96) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
      const road = ownGeometry(new THREE.BufferGeometry());
      road.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      road.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      road.setIndex(indices); road.computeVertexNormals();
      mesh(group, road, roadMaterial, 0, 0, 0, 1, 1, 1, false);
    }
  }

  function instances(group, geometry, material, transforms, shadow = true) {
    const object = new THREE.InstancedMesh(geometry, material, transforms.length);
    instanceMeshes.add(object);
    transforms.forEach((v, i) => {
      dummy.position.set(v[0], v[1], v[2]); dummy.rotation.set(v[7] || 0, v[6] || 0, v[8] || 0);
      dummy.scale.set(v[3], v[4], v[5]); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix);
      if (v[9] !== undefined) object.setColorAt(i, new THREE.Color(v[9]));
    });
    object.castShadow = shadow; object.receiveShadow = true;
    object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    applyCutoutShadow(object, material);
    object.computeBoundingSphere(); group.add(object); return object;
  }

  function segment(transforms, a, b, radius) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    const center = start.add(end).multiplyScalar(.5);
    transforms.push([center.x, center.y, center.z, radius, delta.length(), radius, rotation.y, rotation.x, rotation.z]);
  }

  function crossedCards(count, textureWidth, textureHeight) {
    const positions = [], normals = [], uv = [], indices = [];
    // Half-texel inset plus transparent padding; each card stays inside its own sheet.
    const u0 = .5 / textureWidth, u1 = 1 - u0, v0 = .5 / textureHeight, v1 = 1 - v0;
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI / count, x = Math.cos(a) * .5, z = Math.sin(a) * .5, n = i * 4;
      positions.push(-x, 0, -z, x, 0, z, x, 1, z, -x, 1, -z);
      // Needle tufts are volumes: slightly upward normals soften flat card lighting, not emission.
      const normal = new THREE.Vector3(-Math.sin(a), .48, Math.cos(a)).normalize();
      for (let k = 0; k < 4; k++) normals.push(normal.x, normal.y, normal.z);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1); indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
    return geometry;
  }
  const treeCards = crossedCards(3, 96, 160), distantTreeCards = crossedCards(2, 96, 160);
  const grassCards = crossedCards(3, 64, 64), flowerCards = crossedCards(2, 32, 48);

  function ridges(group, kind) {
    // Continuous, smooth height fields embedded in the terrain, never stretched polyhedra in the sky.
    for (let layer = 0; layer < 2; layer++) {
      const positions = [], colors = [], indices = [], columns = 112, rows = 16;
      const color = new THREE.Color();
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        const u = i / columns, v = j / rows, x = -168 + u * 336;
        const z = (layer === 0 ? -199 : -169) - v * (layer === 0 ? 35 : 49);
        const silhouette = 15 + 5 * Math.sin(x * .027 + layer * 2) + 3 * Math.sin(x * .071 - layer) + 1.3 * Math.cos(x * .14);
        const envelope = Math.pow(Math.sin(Math.PI * v), 1.4) * smooth(u * 8) * smooth((1 - u) * 8);
        const riverCorridor = kind === 'valley' ? smooth((Math.abs(x + 26 - Math.sin(z * .028) * 6) - 9) / 13) : 1;
        const y = heightAt(kind, x, z) - .16 + silhouette * envelope * riverCorridor;
        positions.push(x, y, z);
        color.set(layer === 0 ? '#9b9e99' : '#919789');
        color.multiplyScalar(.93 + .07 * Math.cos(x * .041 + v * 2)); colors.push(color.r, color.g, color.b);
        if (i < columns && j < rows) {
          const n = j * (columns + 1) + i;
          indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
        }
      }
      const geometry = ownGeometry(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      mesh(group, geometry, ridgeMaterial, 0, 0, 0, 1, 1, 1, false);
    }
  }
  const ridgeMaterial = standard('#ffffff', {vertexColors: true});

  function landscape(group, kind) {
    terrain(group, kind);
    const trunks = [], stones = [], bushes = [], grasses = [], flowers = [], litter = [];
    const crowns = Array.from({length: 4}, () => []), farCrowns = Array.from({length: 4}, () => []);
    const treeTints = ['#fff5df', '#e9efdf', '#f4e9d3', '#e4ebde'];
    function tree(x, z, h, variant, distant = false, dead = false) {
      const y = heightAt(kind, x, z), yaw = random() * Math.PI;
      const lean = (variant - 1.5) * h * .015;
      segment(trunks, [x, y, z], [x + lean, y + h * (dead ? .89 : .80), z], h * (distant ? .014 : .021));
      if (!dead) {
        (distant ? farCrowns : crowns)[variant].push([x, y, z, h * (.56 + variant * .045), h, h * (.56 + variant * .045), yaw, 0, 0, treeTints[variant]]);
      }
      if (!distant) for (let k = 0; k < (dead ? 7 : 3); k++) {
        const a = yaw + k * 2.4, level = h * (.22 + k * (dead ? .083 : .09)), reach = h * (.13 + .07 * random());
        const start = [x + lean * level / h, y + level, z];
        const elbow = [x + Math.cos(a) * reach * .65, y + level + h * .024, z + Math.sin(a) * reach * .65];
        const tip = [x + Math.cos(a) * reach, y + level + h * (k % 2 ? .065 : -.026), z + Math.sin(a) * reach];
        segment(trunks, start, elbow, h * .008); segment(trunks, elbow, tip, h * .004);
      }
    }
    for (let i = 0; i < 210; i++) {
      const z = -110 + random() * 144;
      const side = random() < .5 ? -1 : 1;
      const x = side * (9 + random() * 61);
      if (Math.hypot(x, z) < 17 || (kind === 'crossing' && Math.abs(z + 5) < 10)) continue;
      if (kind === 'valley' && Math.abs(x + 26 - Math.sin(z * .028) * 6) < 11) continue;
      const h = 4.4 + Math.pow(random(), .8) * 10.6;
      tree(x, z, h, i % 4, z < -88, i % 17 === 0);
    }
    for (let i = 0; i < 150; i++) {
      const x = -156 + i * 2.08 + random() * 2.4, z = -117 - random() * 43;
      if (kind === 'valley' && Math.abs(x + 26 - Math.sin(z * .028) * 6) < 11) continue;
      if (Math.sin(x * .08) + random() < -.3) continue;
      tree(x, z, 3.2 + random() * 7 + 1.2 * Math.sin(x * .07), i % 4, true);
    }
    for (let i = 0; i < 2100; i++) {
      const x = (random() - .5) * 104, z = -86 + random() * 118;
      if (Math.abs(x) < 3.1 || (kind === 'crossing' && Math.abs(z + 5) < 9)) continue;
      if (kind === 'camp' && [[-8, -5], [7.4, -8], [-1.5, -14], [-3.8, 2.2]].some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 3)) continue;
      const y = heightAt(kind, x, z);
      if (y < -1) continue;
      const patch = .50 + .23 * Math.sin(x * .21 + Math.sin(z * .12)) + .22 * Math.cos(z * .19 - x * .09);
      if (random() > patch) continue;
      const s = .26 + random() * .60, yaw = random() * Math.PI;
      grasses.push([x, y - .025, z, s * 1.3, s * .86, s * 1.3, yaw, 0, 0, i % 3 ? '#f3e7c9' : '#d6d4b1']);
      if (i % 4 === 0) stones.push([x, y + s * .12, z, s * .52, s * .30, s * .43, yaw]);
      if (i % 13 === 0 && Math.hypot(x, z) > 10) bushes.push([x, y, z, 1.1 + s, .6 + s * .6, 1.1 + s, yaw]);
      if (i % 19 === 0 && z > -55) flowers.push([x + .16, y, z, s * .9, s * .72, s * .9, yaw]);
      // XYZ Euler: spin in the sheet's XY plane before laying it on the ground.
      if (i % 7 === 0) litter.push([x, y + .055, z, 1.2 + s, 1.2 + s, 1, 0, -Math.PI / 2, yaw]);
    }
    for (let i = 0; i < 36; i++) {
      const x = (i % 2 ? 1 : -1) * (7 + random() * 43), z = -78 + random() * 90;
      if (kind === 'crossing' && Math.abs(z + 5) < 10) continue;
      if (kind === 'camp' && Math.hypot(x, z) < 18) continue;
      const y = heightAt(kind, x, z), s = .75 + random() * 1.6;
      if (y < -.5) continue;
      stones.push([x, y + s * .22, z, s, s * .61, s * .78, random() * Math.PI]);
      if (i % 6 === 0) segment(trunks, [x - 1.3, heightAt(kind, x - 1.3, z) + .17, z], [x + 1.3, heightAt(kind, x + 1.3, z + .8) + .19, z + .8], .16);
    }
    instances(group, trunkGeometry, bark, trunks);
    for (let i = 0; i < 4; i++) {
      instances(group, treeCards, pineMaterials[i], crowns[i]);
      instances(group, distantTreeCards, pineMaterials[i], farCrowns[i]);
    }
    instances(group, rockGeometry, stone, stones);
    instances(group, grassCards, scrubMaterial, bushes);
    instances(group, grassCards, grassMaterial, grasses);
    instances(group, flowerCards, flowerMaterial, flowers, false);
    instances(group, unitPlane, litterMaterial, litter, false);
    ridges(group, kind);
    if (kind === 'valley') {
      const cliffs = [];
      for (let i = 0; i < 16; i++) {
        const x = 27 + random() * 13, z = -19 - i * 5.2, h = 5 + random() * 5;
        cliffs.push([x, heightAt(kind, x, z) + h * .40, z, 5 + random() * 5, h, 6, random()]);
      }
      instances(group, rockGeometry, standard('#e0cbb4', {map: rockTexture}), cliffs);
    }
  }

  const waters = [];
  function water(group, kind) {
    const material = ownMaterial(new THREE.MeshStandardMaterial({
      color: '#486b70', roughness: .27, metalness: .45,
      emissive: '#25484e', emissiveIntensity: .12, side: THREE.DoubleSide,
    }));
    const time = {value: 0};
    material.onBeforeCompile = shader => {
      shader.uniforms.westernTime = time;
      shader.vertexShader = 'uniform float westernTime; varying vec3 westernWater;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        westernWater = position;
        transformed.y += .045 * sin(position.x * 2.2 + westernTime * 1.1)
          + .024 * cos(position.z * 4.0 - westernTime * 1.45);
      `);
      shader.fragmentShader = 'uniform float westernTime; varying vec3 westernWater;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float ripple = sin(westernWater.x * 3.5 + westernWater.z * 1.3 - westernTime * 1.4);
        float glint = pow(max(0.0, ripple), 18.0);
        diffuseColor.rgb += vec3(.11, .13, .11) * glint;
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        normal = normalize(normal + vec3(.07 * cos(westernWater.x * 2.2 + westernTime),
          .03 * sin(westernWater.z * 4.0 - westernTime), 0.0));
      `);
    };
    material.customProgramCacheKey = () => 'western-river-v1';
    let geometry;
    if (kind === 'crossing') {
      geometry = ownGeometry(new THREE.PlaneGeometry(290, 16, 110, 20));
      geometry.rotateX(-Math.PI / 2); geometry.translate(0, -.64, -5);
    } else {
      geometry = ownGeometry(new THREE.PlaneGeometry(19, 280, 20, 160));
      geometry.rotateX(-Math.PI / 2); geometry.translate(-26, -1.1, -60);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getZ(i) * .028) * 6);
      geometry.computeVertexNormals();
    }
    const surface = mesh(group, geometry, material, 0, 0, 0, 1, 1, 1, false);
    waters.push({surface, time});
  }

  function tent(group, x, z, scale = 1, blue = false) {
    const root = new THREE.Group(); root.position.set(x, 0, z); root.scale.setScalar(scale); group.add(root);
    const geometry = ownGeometry(new THREE.BufferGeometry());
    const positions = [], uv = [], indices = [], columns = 20, rows = 10;
    for (const side of [-1, 1]) {
      const offset = positions.length / 3;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        const u = i / columns, v = j / rows, tension = Math.sin(v * Math.PI) * Math.sin(u * Math.PI);
        const fold = tension * (.035 + .017 * Math.sin(u * Math.PI * 10));
        positions.push(side * (2 * (1 - v) + fold), 2.8 * v - .075 * tension, -1.7 + u * 3.4);
        uv.push(u, v);
        if (i < columns && j < rows) {
          const n = offset + j * (columns + 1) + i, next = n + columns + 1;
          if (side === -1) indices.push(n, n + 1, next, n + 1, next + 1, next);
          else indices.push(n, next, n + 1, n + 1, next, next + 1);
        }
      }
    }
    let n = positions.length / 3;
    positions.push(-2, 0, -1.7, 0, 2.8, -1.7, 2, 0, -1.7);
    uv.push(0, 0, .5, 1, 1, 0); indices.push(n, n + 1, n + 2);
    // Tied-back entrance flaps leave a genuinely open, shadowed interior.
    for (const side of [-1, 1]) {
      n = positions.length / 3;
      positions.push(side * 2, 0, 1.7, side * .58, .06, 1.80, side * .22, 2.35, 1.74, 0, 2.8, 1.7);
      uv.push(0, 0, .7, 0, .7, .8, 1, 1);
      if (side === -1) indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
      else indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
    geometry.computeVertexNormals(); mesh(root, geometry, blue ? blueCloth : cloth, 0, 0, 0);
    beam(root, [0, 0, 1.8], [0, 2.95, 1.8], .11);
    beam(root, [0, 2.8, 1.9], [0, 2.8, -1.9], .11);
    const ties = [], stakes = [];
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      segment(ties, [side * 1.28, 1.06, end * 1.55], [side * 3.2, .12, end * 2], .014);
      segment(ties, [side * 2.02, .03, end * 1.72], [0, 2.81, end * 1.72], .018);
      stakes.push([side * 3.2, .1, end * 2, .075, .32, .075, 0, 0, side * .18]);
    }
    instances(root, trunkGeometry, ropeMaterial, ties);
    instances(root, unitBox, darkWood, stakes);
    box(root, darkWood, .7, .12, .2, 1.6, .16, 2.4);
    box(root, blue ? cloth : blueCloth, .7, .22, .2, 1.35, .10, 2.15);
    const roll = mesh(root, rollGeometry, blue ? blueCloth : cloth, .7, .42, -.60); roll.rotation.z = Math.PI / 2;
    return root;
  }

  function crate(group, x, y, z, scale = 1) {
    const root = new THREE.Group(); root.position.set(x, y, z); root.scale.setScalar(scale); group.add(root);
    box(root, wood, 0, .4, 0, .95, .8, .8);
    const battens = [], nails = [];
    for (const s of [-1, 1]) for (const end of [-1, 1]) {
      battens.push([s * .35, .4, end * .426, .10, .79, .052]);
      battens.push([end * .488, .4, s * .27, .045, .79, .09]);
      for (const y of [.13, .67]) nails.push([s * .35, y, end * .46, .028, .028, .015]);
    }
    for (const z of [-.27, .27]) battens.push([0, .817, z, .95, .04, .09]);
    instances(root, unitBox, paleWood, battens); instances(root, unitBox, metal, nails, false);
    return root;
  }

  function paper(group) {
    const root = new THREE.Group(), hinge = new THREE.Group(); group.add(root); root.add(hinge);
    const left = mesh(root, unitPlane, mapMaterial, -.24, 0, 0, .48, .7, 1, false);
    const right = mesh(hinge, unitPlane, mapMaterial, .24, 0, 0, .48, .7, 1, false);
    // Independent half-atlas sampling, not the same whole map on both leaves.
    for (const [object, x] of [[left, 0], [right, .5]]) {
      const tex = mapTexture.clone(); tex.repeat.set(.5, 1); tex.offset.set(x, 0); textures.add(tex);
      object.material = ownMaterial(mapMaterial.clone()); object.material.map = tex;
    }
    return {root, hinge, setFold: amount => { hinge.rotation.y = -clamp(amount) * Math.PI * .965; }};
  }

  function wagon(group) {
    const root = new THREE.Group(); group.add(root);
    box(root, darkWood, 0, .85, 0, 2, .22, 3.7);
    for (const x of [-1, 1]) {
      box(root, wood, x, 1.25, 0, .12, .7, 3.7);
      beam(root, [x * .72, .7, -1.4], [x * .72, .7, -4.8], .11);
    }
    box(root, wood, 0, 1.24, 1.82, 2.1, .7, .12);
    const staves = [], fittings = [];
    for (const x of [-1.08, 1.08]) for (const z of [-1.55, -.1, 1.55]) {
      staves.push([x, 1.26, z, .075, .82, .10]);
      for (const y of [.95, 1.56]) fittings.push([x, y, z, .10, .10, .15]);
    }
    for (const z of [-1.14, 1.14]) fittings.push([0, .67, z, 2.38, .10, .10]);
    instances(root, unitBox, paleWood, staves); instances(root, unitBox, metal, fittings);
    const wheels = [];
    for (const x of [-1.17, 1.17]) for (const z of [-1.14, 1.14]) {
      const wheel = new THREE.Group(); wheel.position.set(x, .67, z); root.add(wheel);
      const rim = mesh(wheel, wheelGeometry, darkWood, 0, 0, 0); rim.rotation.y = Math.PI / 2;
      const tire = mesh(wheel, tireGeometry, metal, 0, 0, 0); tire.rotation.y = Math.PI / 2;
      const spokes = [];
      for (let i = 0; i < 7; i++) {
        spokes.push([0, 0, 0, .07, 1.25, .055, 0, i * Math.PI / 7]);
      }
      instances(wheel, unitBox, paleWood, spokes);
      const hub = mesh(wheel, hubGeometry, metal, 0, 0, 0); hub.rotation.z = Math.PI / 2;
      wheels.push(wheel);
    }
    const canopy = ownGeometry(new THREE.CylinderGeometry(1.07, 1.07, 3.25, 28, 12, true, -Math.PI / 2, Math.PI));
    canopy.rotateX(-Math.PI / 2);
    const p = canopy.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const arch = Math.max(0, p.getY(i) / 1.07), along = clamp(p.getZ(i) / 3.25 + .5);
      p.setY(i, p.getY(i) - .035 * arch * Math.sin(along * Math.PI) * (1 + .3 * Math.cos(along * Math.PI * 8)));
    }
    canopy.computeVertexNormals();
    mesh(root, canopy, cloth, 0, 1.65, -.1);
    const arc = ownGeometry(new THREE.TorusGeometry(1.07, .045, 5, 28, Math.PI));
    instances(root, arc, paleWood, [-1.7, -.6, .6, 1.5].map(z => [0, 1.65, z, 1, 1, 1]));
    const cargo = [crate(root, -.48, .97, .85, .75), crate(root, .42, .97, .8, .75), crate(root, 0, 1.6, .76, .58)];
    return {root, wheels, cargo};
  }

  const valley = new THREE.Group(), camp = new THREE.Group(), trail = new THREE.Group(), crossing = new THREE.Group();
  valley.name = 'valley'; camp.name = 'camp'; trail.name = 'trail'; crossing.name = 'crossing';
  landscape(valley, 'valley'); water(valley, 'valley');
  landscape(camp, 'camp'); landscape(trail, 'trail'); landscape(crossing, 'crossing'); water(crossing, 'crossing');

  tent(camp, -8, -5, 1.15); tent(camp, 7.4, -8, 1.1, true); tent(camp, -1.5, -14, .95);
  const table = new THREE.Group(); table.position.set(0, 0, -.65); camp.add(table);
  box(table, paleWood, 0, 1.04, 0, 3.25, .15, 1.25);
  for (const x of [-1.35, 1.35]) for (const z of [-.44, .44]) box(table, darkWood, x, .49, z, .16, .98, .16);
  beam(table, [-1.4, .25, .4], [1.4, .87, .4], .1);
  const campMap = paper(camp);
  const cupGeometry = ownGeometry(new THREE.CylinderGeometry(.11, .09, .24, 8));
  mesh(table, cupGeometry, metal, 1.22, 1.23, .08);
  box(table, darkWood, -.9, 1.16, -.2, .5, .08, .32);
  for (let i = 0; i < 7; i++) crate(camp, 6.2 + (i % 3) * 1.04, i > 3 ? .8 : 0, -2.8 - Math.floor(i / 3) * .8, .9);
  const barrelGeometry = ownGeometry(new THREE.CylinderGeometry(.43, .43, 1.25, 20, 8));
  const barrelPositions = barrelGeometry.attributes.position;
  for (let i = 0; i < barrelPositions.count; i++) {
    const bulge = 1 + .14 * Math.cos(barrelPositions.getY(i) / 1.25 * Math.PI);
    barrelPositions.setX(i, barrelPositions.getX(i) * bulge); barrelPositions.setZ(i, barrelPositions.getZ(i) * bulge);
  }
  barrelGeometry.computeVertexNormals();
  instances(camp, barrelGeometry, wood, [0, 1, 2].map(i => [-5.6 - i, .625, -1.4, 1, 1, 1]));
  const hoopGeometry = ownGeometry(new THREE.TorusGeometry(.46, .026, 5, 20)), hoops = [];
  for (let i = 0; i < 3; i++) for (const y of [.18, .625, 1.07]) {
    const radius = .43 * (1 + .14 * Math.cos((y - .625) / 1.25 * Math.PI));
    hoops.push([-5.6 - i, y, -1.4, radius / .46, radius / .46, 1, 0, Math.PI / 2]);
  }
  instances(camp, hoopGeometry, metal, hoops);
  beam(camp, [-8, 0, -10], [-8, 3.2, -10], .13);
  beam(camp, [-2.7, 0, -10], [-2.7, 3.2, -10], .13);
  beam(camp, [-8, 3, -10], [-2.7, 3, -10], .024, darkWood);
  for (let i = 0; i < 5; i++) mesh(camp, unitPlane, i % 2 ? blueCloth : cloth, -7.5 + i, 2.4, -10, .6, .9, 1);
  // A hitching rail, bedrolls and a real lantern, all independently shadowed.
  for (const x of [8.5, 13]) beam(camp, [x, 0, -2], [x, 1.6, -2], .16);
  beam(camp, [8.3, 1.3, -2], [13.2, 1.3, -2], .16);
  const lantern = new THREE.Group(); lantern.position.set(2.05, 1.2, -1.1); camp.add(lantern);
  box(camp, darkWood, 2.05, .565, -1.1, .17, 1.13, .17);
  box(camp, paleWood, 2.05, 1.145, -1.1, .39, .045, .39);
  box(camp, darkWood, 2.05, .045, -1.1, .48, .09, .48);
  box(lantern, lanternMaterial, 0, .16, 0, .14, .29, .14);
  for (const x of [-.105, .105]) for (const z of [-.105, .105]) box(lantern, metal, x, .17, z, .025, .37, .025);
  box(lantern, metal, 0, .37, 0, .28, .055, .28); box(lantern, metal, 0, -.035, 0, .27, .07, .27);
  const lampLight = new THREE.PointLight('#ffc078', 5, 9, 2); lampLight.position.set(2.05, 1.62, -1.1); camp.add(lampLight);
  const firePosition = new THREE.Vector3(-3.8, .08, 2.2);
  const fire = new THREE.Group(); fire.position.copy(firePosition); camp.add(fire);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    mesh(fire, rockGeometry, stone, Math.cos(a) * .75, .1, Math.sin(a) * .75, .25, .19, .2);
  }
  for (let i = 0; i < 3; i++) { const log = box(fire, darkWood, 0, .2, 0, 1.1, .2, .2); log.rotation.y = i * 1.04; }
  const fireTexture = canvasTexture(32, 48, c => {
    for (let x = 4; x < 29; x += 3) {
      const h = 8 + Math.floor(random() * 32);
      c.fillStyle = '#e98139'; c.fillRect(x, 47 - h, 3, h);
      c.fillStyle = '#ffd180'; c.fillRect(x, 48 - h * .6, 2, h * .6);
    }
  });
  const fireMaterial = ownMaterial(new THREE.MeshBasicMaterial({map: fireTexture, color: '#ffd298', alphaTest: .4, side: THREE.DoubleSide}));
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const flame = mesh(fire, unitPlane, fireMaterial, (i - 1) * .18, .57, 0, .64, .84, 1, false);
    flame.rotation.y = i * Math.PI / 3; flames.push(flame);
  }
  const fireLight = new THREE.PointLight('#ffad65', 23, 18, 2);
  fireLight.position.set(-3.8, 1.1, 2.2); fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(512, 512); fireLight.shadow.camera.near = .15;
  fireLight.shadow.bias = -.00015; fireLight.shadow.normalBias = .01;
  camp.add(fireLight);

  const trailWagon = wagon(trail); trailWagon.root.position.set(0, 0, 0);
  const unloaded = [crate(trail, 3.3, 0, 2.4, .75), crate(trail, 4.2, 0, 1.9, .75), crate(trail, 3.8, 0, 2.8, .58)];
  const rutMaterial = standard('#4b4236');
  for (const x of [-1.18, 1.18]) box(trail, rutMaterial, x, -.035, 1.18, .35, .05, 2.2);
  for (let i = 0; i < 4; i++) box(trail, paleWood, -1.17, .03, .9 + i * .3, .5, .08, .14);

  const bridge = new THREE.Group(); crossing.add(bridge);
  for (const x of [-1.65, 1.65]) {
    box(bridge, darkWood, x, .07, -5, .28, .37, 15.6);
    for (const z of [2, -2, -6, -10, -12]) {
      const footing = heightAt('crossing', x, z) - .22;
      box(bridge, wood, x, (footing + 1.37) / 2, z, .24, 1.37 - footing, .24);
      box(bridge, paleWood, x, 1.12, z, .19, 1.7, .19);
    }
    beam(bridge, [x, 1.88, 2.65], [x, 1.88, -12.65], .12);
    beam(bridge, [x, 1.12, 2.65], [x, 1.12, -12.65], .095);
    for (const z of [-1, -5, -9]) beam(bridge, [x, -.7, z + 2], [x, .14, z - 2], .18);
  }
  const boards = [];
  for (let i = 0; i < 51; i++) boards.push([0, .32 + (i % 5 === 0 ? .012 : 0), 2.6 - i * .3, 3.64, .18, .276, 0]);
  instances(bridge, unitBox, paleWood, boards);
  for (const z of [3.05, -12.85]) box(bridge, wood, 0, .13, z, 3.6, .22, .6);
  const crossingMap = paper(crossing);

  // Localized haze occupies real world space; it cannot paint across nearer silhouettes.
  const atmosphere = new THREE.Group(); atmosphere.name = 'world-space-atmosphere';
  const hazeMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {tint: {value: new THREE.Color('#bfbb9e')}, opacity: {value: .08}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float opacity;
      void main(){
        float edge = pow(max(0.0, sin(vUv.x*3.14159265)*sin(vUv.y*3.14159265)), 1.7);
        gl_FragColor=vec4(tint,edge*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const fogSheets = [];
  for (let i = 0; i < 7; i++) fogSheets.push(mesh(atmosphere, unitPlane, hazeMaterial, (i % 2 ? 14 : -12), 1.5 + i * .2, -20 - i * 13, 70, 3.8 + i, 1, false));
  const shaftMaterial = hazeMaterial.clone(); ownMaterial(shaftMaterial);
  shaftMaterial.uniforms = THREE.UniformsUtils.clone(hazeMaterial.uniforms);
  shaftMaterial.uniforms.opacity.value = .022;
  const shafts = [];
  for (let i = 0; i < 4; i++) {
    const shaft = mesh(atmosphere, unitPlane, shaftMaterial, -11 + i * 9, 8, -16 - i * 8, 1.4 + i * .3, 22, 1, false);
    shaft.rotation.z = -.45; shafts.push(shaft);
  }
  const moteCount = 100, moteSeeds = new Float32Array(moteCount * 4), motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteSeeds.length; i++) moteSeeds[i] = random();
  const moteGeometry = ownGeometry(new THREE.BufferGeometry());
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = ownMaterial(new THREE.PointsMaterial({color: '#d3be92', size: .033, transparent: true, opacity: .35, depthWrite: false}));
  const motes = new THREE.Points(moteGeometry, moteMaterial); motes.frustumCulled = false; atmosphere.add(motes);
  const emberCount = 22, emberPositions = new Float32Array(emberCount * 3);
  const emberGeometry = ownGeometry(new THREE.BufferGeometry());
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMaterial = ownMaterial(new THREE.PointsMaterial({color: '#ffb25b', size: .045, depthWrite: false, transparent: true, opacity: .7}));
  const embers = new THREE.Points(emberGeometry, emberMaterial); embers.frustumCulled = false; fire.add(embers);

  const groups = {valley, camp, trail, crossing};
  function update(name, time, reduced) {
    const t = reduced ? 0 : time;
    for (const item of waters) item.time.value = t;
    const isNight = name === 'camp-night', isCold = name === 'camp-cold';
    lampLight.intensity = isNight ? 11 : isCold ? 3.5 : 2;
    fireLight.intensity = (isNight ? 38 : isCold ? 15 : 24) * (1 + .025 * Math.sin(t * 2.3) + .018 * Math.sin(t * 3.7));
    flames.forEach((f, i) => { f.scale.y = .78 + .10 * Math.sin(t * 3 + i * 2); f.position.y = .18 + f.scale.y * .5; });
    hazeMaterial.uniforms.opacity.value = isNight ? .038 : name === 'crossing' ? .105 : .066;
    hazeMaterial.uniforms.tint.value.set(isNight ? '#647982' : isCold ? '#9baeb2' : '#c6b699');
    shaftMaterial.uniforms.tint.value.set(isCold || isNight ? '#8097a8' : '#e1c395');
    shafts.forEach(s => { s.visible = !isNight; });
    fogSheets.forEach((sheet, i) => { sheet.position.x = (i % 2 ? 14 : -12) + Math.sin(t * .024 + i) * 3; });
    for (let i = 0; i < moteCount; i++) {
      const s = i * 4;
      motePositions[i * 3] = (moteSeeds[s] - .5) * 34 + Math.sin(t * .13 + moteSeeds[s + 3] * 8) * .4;
      motePositions[i * 3 + 1] = .5 + ((moteSeeds[s + 1] + t * .008) % 1) * 6;
      motePositions[i * 3 + 2] = -18 + moteSeeds[s + 2] * 31;
    }
    moteGeometry.attributes.position.needsUpdate = true;
    motes.visible = !isNight;
    for (let i = 0; i < emberCount; i++) {
      const p = (i / emberCount + t * .13) % 1;
      emberPositions[i * 3] = Math.sin(i * 2.4 + p * 5) * (.13 + p * .35);
      emberPositions[i * 3 + 1] = .38 + p * 1.85;
      emberPositions[i * 3 + 2] = Math.cos(i * 1.9 + p * 3) * .28;
    }
    emberGeometry.attributes.position.needsUpdate = true;
  }

  let disposed = false;
  return {
    groups, atmosphere,
    props: {campMap, crossingMap, table, trailWagon, unloaded, bridge, fireLight, lampLight},
    heightAt, update,
    info: () => ({geometryCount: geometries.size, textureCount: textures.size, materialCount: materials.size}),
    dispose() {
      if (disposed) return; disposed = true;
      for (const object of instanceMeshes) {
        object.morphTexture?.dispose(); object.morphTexture = null;
        object.dispose();
      }
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      fireLight.shadow.map?.dispose(); lampLight.shadow.map?.dispose();
      for (const g of Object.values(groups)) g.removeFromParent();
      atmosphere.removeFromParent();
    },
  };
}