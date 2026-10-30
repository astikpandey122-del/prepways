/**
 * PrepWays 3D science scenes (Three.js).
 *
 * Modes:
 *  - jee    : atom + torus-knot "math" wireframe + physics waves
 *  - neet   : large DNA helix + cell + red blood cells
 *  - school : connected network globe + graduation caps + books
 *
 * The scene rebuilds itself on theme change so colours and blending
 * suit both light and dark backgrounds.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const PALETTES = {
  dark: {
    primary: 0x8b5cf6,
    secondary: 0x22d3ee,
    accent: 0xf472b6,
    warm: 0xfbbf24,
    blood: 0xf43f5e,
    particle: 0xa5b4fc,
    line: 0x818cf8,
    blending: THREE.AdditiveBlending,
    glowOpacity: 0.9,
    lineOpacity: 0.35,
  },
  light: {
    primary: 0x6d28d9,
    secondary: 0x0891b2,
    accent: 0xdb2777,
    warm: 0xd97706,
    blood: 0xe11d48,
    particle: 0x6366f1,
    line: 0x7c3aed,
    blending: THREE.NormalBlending,
    glowOpacity: 0.45,
    lineOpacity: 0.3,
  },
};

/* ---------------------------------------------------------------- helpers */

let glowTexture;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function glowSprite(color, size, p, opacity = p.glowOpacity) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    depthWrite: false,
    blending: p.blending,
    opacity,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

function glossy(color, emissive = 0.3) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    roughness: 0.28,
    metalness: 0.25,
  });
}

/** Cylinder bond between two points. */
function bond(a, b, radius, material) {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material);
  mesh.scale.y = len;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

/* --------------------------------------------------------------- builders */

function makeAtom(p) {
  const group = new THREE.Group();
  const updaters = [];

  // Nucleus: protons + neutrons packed on a golden-spiral sphere
  const nucleus = new THREE.Group();
  const nGeo = new THREE.SphereGeometry(0.15, 24, 24);
  const proton = glossy(p.accent, 0.4);
  const neutron = glossy(p.primary, 0.35);
  const count = 20;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const m = new THREE.Mesh(nGeo, i % 2 ? proton : neutron);
    m.position.set(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(0.22);
    nucleus.add(m);
  }
  nucleus.add(glowSprite(p.accent, 1.8, p));
  group.add(nucleus);
  updaters.push((t) => {
    nucleus.rotation.y = t * 0.6;
    nucleus.rotation.x = t * 0.25;
    nucleus.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
  });

  // Three tilted electron orbits (slowly precessing as a set)
  const orbits = new THREE.Group();
  group.add(orbits);
  updaters.push((t) => {
    orbits.rotation.z = t * 0.12;
  });
  const R = 1.55;
  const colors = [p.secondary, p.primary, p.accent];
  colors.forEach((col, i) => {
    const outer = new THREE.Group();
    outer.rotation.z = (i * Math.PI) / 3;
    const inner = new THREE.Group();
    inner.rotation.x = 1.15;
    outer.add(inner);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.01, 8, 200),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 }),
    );
    inner.add(ring);

    const electron = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    electron.add(glowSprite(col, 0.7, p));
    inner.add(electron);

    // Fading trail behind each electron
    const trail = [];
    for (let k = 1; k <= 10; k++) {
      const s = glowSprite(col, 0.32 - k * 0.022, p, p.glowOpacity * (1 - k / 11));
      inner.add(s);
      trail.push(s);
    }

    const speed = 1.1 + i * 0.35;
    const offset = i * 2.1;
    updaters.push((t) => {
      const a = t * speed + offset;
      electron.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      trail.forEach((s, k) => {
        const b = a - (k + 1) * 0.07;
        s.position.set(Math.cos(b) * R, Math.sin(b) * R, 0);
      });
    });

    orbits.add(outer);
  });

  // Faint quantum "shell"
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.15, 1)),
    new THREE.LineBasicMaterial({ color: p.line, transparent: true, opacity: p.lineOpacity * 0.35 }),
  );
  group.add(shell);
  updaters.push((t) => {
    shell.rotation.y = -t * 0.08;
    shell.rotation.x = t * 0.05;
  });

  return { group, update: (t) => updaters.forEach((u) => u(t)) };
}

function makeDNA(p, { pairs = 26, radius = 0.55, rise = 0.17, twist = 0.4 } = {}) {
  const group = new THREE.Group();
  const height = (pairs - 1) * rise;
  const nodeGeo = new THREE.SphereGeometry(0.075, 16, 16);
  const rungGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 8);
  const strandA = glossy(p.secondary, 0.45);
  const strandB = glossy(p.accent, 0.45);
  // Base-pair colours (A, T, G, C)
  const bases = [p.primary, p.warm, p.secondary, p.accent].map((c) => glossy(c, 0.25));
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < pairs; i++) {
    const a = i * twist;
    const y = i * rise - height / 2;
    const pa = new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
    const pb = new THREE.Vector3(Math.cos(a + Math.PI) * radius, y, Math.sin(a + Math.PI) * radius);
    const na = new THREE.Mesh(nodeGeo, strandA);
    const nb = new THREE.Mesh(nodeGeo, strandB);
    na.position.copy(pa);
    nb.position.copy(pb);
    group.add(na, nb);

    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    [
      [pa, bases[i % 4]],
      [pb, bases[(i + 2) % 4]],
    ].forEach(([pt, mat]) => {
      const rung = new THREE.Mesh(rungGeo, mat);
      rung.scale.y = pt.distanceTo(mid);
      rung.position.copy(pt).add(mid).multiplyScalar(0.5);
      rung.quaternion.setFromUnitVectors(up, mid.clone().sub(pt).normalize());
      group.add(rung);
    });
  }

  // Smooth sugar-phosphate backbones
  [0, Math.PI].forEach((off, idx) => {
    const pts = [];
    const steps = (pairs - 1) * 4;
    for (let i = 0; i <= steps; i++) {
      const k = i / 4;
      const a = k * twist + off;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, k * rise - height / 2, Math.sin(a) * radius));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 0.028, 8, false),
      new THREE.MeshStandardMaterial({
        color: idx ? p.accent : p.secondary,
        emissive: idx ? p.accent : p.secondary,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.75,
        roughness: 0.4,
      }),
    );
    group.add(tube);
  });

  return {
    group,
    update: (t) => {
      group.rotation.y = t * 0.45;
    },
  };
}

function makeMolecule(p, type = 'tetra') {
  const group = new THREE.Group();
  const bondMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.1 });

  if (type === 'ring') {
    // Benzene-style hexagonal ring
    const atomMat = glossy(p.primary, 0.35);
    const hMat = glossy(p.secondary, 0.35);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0));
    }
    pts.forEach((pt, i) => {
      const atom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), atomMat);
      atom.position.copy(pt);
      group.add(atom, bond(pt, pts[(i + 1) % 6], 0.03, bondMat));
      const hp = pt.clone().multiplyScalar(1.75);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), hMat);
      h.position.copy(hp);
      group.add(h, bond(pt, hp, 0.02, bondMat));
    });
  } else {
    // Tetrahedral (methane-like) molecule
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), glossy(p.primary, 0.35));
    group.add(center);
    const outerMat = glossy(type === 'water' ? p.blood : p.secondary, 0.35);
    const dirs =
      type === 'water'
        ? [new THREE.Vector3(0.8, -0.6, 0), new THREE.Vector3(-0.8, -0.6, 0)]
        : [
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(-1, -1, 1),
            new THREE.Vector3(-1, 1, -1),
            new THREE.Vector3(1, -1, -1),
          ];
    dirs.forEach((d) => {
      const pt = d.normalize().multiplyScalar(0.5);
      const atom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), outerMat);
      atom.position.copy(pt);
      group.add(atom, bond(new THREE.Vector3(), pt, 0.03, bondMat));
    });
  }
  return group;
}

function makeBloodCell(p) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: p.blood,
    emissive: p.blood,
    emissiveIntensity: 0.25,
    roughness: 0.45,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.12, 16, 40), mat);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: p.blood, roughness: 0.6, transparent: true, opacity: 0.85 }),
  );
  disc.rotation.x = Math.PI / 2;
  group.add(torus, disc);
  return group;
}

function makeCell(p) {
  const group = new THREE.Group();
  const membrane = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 48),
    new THREE.MeshStandardMaterial({
      color: p.secondary,
      transparent: true,
      opacity: 0.12,
      roughness: 0.2,
      depthWrite: false,
    }),
  );
  const mesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.01, 2)),
    new THREE.LineBasicMaterial({ color: p.secondary, transparent: true, opacity: p.lineOpacity * 0.6 }),
  );
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), glossy(p.primary, 0.45));
  nucleus.add(glowSprite(p.primary, 1.3, p, p.glowOpacity * 0.6));
  group.add(membrane, mesh, nucleus);

  const mitoMat = glossy(p.warm, 0.3);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 6, 12), mitoMat);
    const a = (i / 5) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.62, Math.sin(a * 1.7) * 0.3, Math.sin(a) * 0.62);
    m.rotation.set(a, a * 0.5, 0);
    group.add(m);
  }
  return {
    group,
    update: (t) => {
      group.rotation.y = t * 0.2;
      mesh.rotation.x = t * 0.1;
      nucleus.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    },
  };
}

function makeNetwork(p) {
  const group = new THREE.Group();
  let geo = new THREE.IcosahedronGeometry(1.7, 1);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);

  const pos = geo.attributes.position;
  const index = geo.index.array;
  const nodes = [];
  for (let i = 0; i < pos.count; i++) nodes.push(new THREE.Vector3().fromBufferAttribute(pos, i));

  // Unique edges + adjacency list
  const edgeSet = new Set();
  const adjacency = nodes.map(() => []);
  for (let i = 0; i < index.length; i += 3) {
    const tri = [index[i], index[i + 1], index[i + 2]];
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        adjacency[a].push(b);
        adjacency[b].push(a);
      }
    }
  }
  const linePos = [];
  edgeSet.forEach((key) => {
    const [a, b] = key.split('-').map(Number);
    linePos.push(...nodes[a].toArray(), ...nodes[b].toArray());
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  group.add(
    new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: p.line, transparent: true, opacity: p.lineOpacity * 1.4 }),
    ),
  );

  // Nodes (schools / students)
  const nodeMats = [glossy(p.primary, 0.4), glossy(p.secondary, 0.4), glossy(p.accent, 0.4)];
  const nodeGeo = new THREE.SphereGeometry(0.075, 16, 16);
  nodes.forEach((n, i) => {
    const m = new THREE.Mesh(nodeGeo, nodeMats[i % 3]);
    m.position.copy(n);
    group.add(m);
  });

  // Data pulses travelling along edges
  const pulses = [];
  for (let i = 0; i < 16; i++) {
    const from = Math.floor(Math.random() * nodes.length);
    const s = glowSprite(i % 2 ? p.secondary : p.accent, 0.35, p);
    group.add(s);
    pulses.push({ sprite: s, from, to: adjacency[from][0], k: Math.random(), speed: 0.4 + Math.random() * 0.5 });
  }

  const core = glowSprite(p.primary, 2.4, p, p.glowOpacity * 0.5);
  group.add(core);

  let last = 0;
  return {
    group,
    update: (t) => {
      const dt = Math.min(t - last, 0.1);
      last = t;
      group.rotation.y = t * 0.15;
      group.rotation.x = Math.sin(t * 0.2) * 0.15;
      pulses.forEach((pl) => {
        pl.k += dt * pl.speed;
        if (pl.k >= 1) {
          pl.k = 0;
          pl.from = pl.to;
          const nbrs = adjacency[pl.from];
          pl.to = nbrs[Math.floor(Math.random() * nbrs.length)];
        }
        pl.sprite.position.lerpVectors(nodes[pl.from], nodes[pl.to], pl.k);
      });
    },
  };
}

function makeGradCap(p) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3730a3,
    emissive: p.primary,
    emissiveIntensity: 0.25,
    roughness: 0.45,
    metalness: 0.2,
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.7), dark);
  board.rotation.y = Math.PI / 4;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2, 24), dark);
  base.position.y = -0.11;
  const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), glossy(p.warm, 0.6));
  tassel.position.set(0.3, -0.1, 0.3);
  const string = bond(new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(0.3, -0.06, 0.3), 0.008, glossy(p.warm, 0.6));
  group.add(board, base, tassel, string);
  return group;
}

function makeBooks(p) {
  const group = new THREE.Group();
  [p.primary, p.secondary, p.accent].forEach((c, i) => {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.6 - i * 0.05, 0.1, 0.42), glossy(c, 0.2));
    book.position.y = i * 0.11;
    book.rotation.y = i * 0.25;
    group.add(book);
  });
  return group;
}

function makeTorusKnot(p) {
  return new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(1.1, 0.3, 120, 10, 2, 3)),
    new THREE.LineBasicMaterial({ color: p.line, transparent: true, opacity: p.lineOpacity * 0.7 }),
  );
}

function makeWaves(p) {
  const group = new THREE.Group();
  const lines = [];
  const N = 160;
  [p.secondary, p.primary, p.accent].forEach((c, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: c,
        size: 0.05,
        transparent: true,
        opacity: 0.85,
        map: getGlowTexture(),
        depthWrite: false,
        blending: p.blending,
      }),
    );
    group.add(pts);
    lines.push({ geo, phase: i * 1.3, amp: 0.25 + i * 0.08, freq: 1.2 + i * 0.4 });
  });
  return {
    group,
    update: (t) => {
      lines.forEach(({ geo, phase, amp, freq }) => {
        const arr = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * 12 - 6;
          arr[i * 3] = x;
          arr[i * 3 + 1] = Math.sin(x * freq + t * 1.5 + phase) * amp;
          arr[i * 3 + 2] = Math.cos(x * 0.5 + t + phase) * 0.3;
        }
        geo.attributes.position.needsUpdate = true;
      });
    },
  };
}

function makeParticles(p, count = 700) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 22;
    arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 3;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: p.particle,
      size: 0.06,
      map: getGlowTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: p.blending,
    }),
  );
  return {
    group: points,
    update: (t) => {
      points.rotation.y = t * 0.02;
      points.rotation.x = Math.sin(t * 0.1) * 0.05;
    },
  };
}

/* ----------------------------------------------------------- composition */

/**
 * Each item: { obj, wide: [x,y,z], narrow: [x,y,z], scale, narrowScale, float, spin }
 * "float" items bob up and down; "spin" items rotate slowly.
 */
function compose(mode, p) {
  const items = [];
  const updaters = [];
  const add = (built, opts) => {
    const obj = built.group ?? built;
    if (built.update) updaters.push(built.update);
    items.push({ obj, phase: Math.random() * Math.PI * 2, ...opts });
  };

  add(makeParticles(p), { wide: [0, 0, 0], narrow: [0, 0, 0] });

  if (mode === 'jee') {
    add(makeAtom(p), { wide: [2.9, 0.1, 0], narrow: [0, 1.6, -1], narrowScale: 0.8, faceCamera: true });
    add(
      { group: makeTorusKnot(p), update: null },
      { wide: [2.9, 0.1, -3], narrow: [0, 1.6, -4], spin: 0.15, scale: 1.6 },
    );
    add(makeWaves(p), { wide: [0, -2.6, -1], narrow: [0, -3, -2] });
    add(makeMolecule(p, 'tetra'), { wide: [-9.4, -4.6, -7], narrow: [-1.8, 3.4, -3], float: 0.25, spin: 0.5 });
    add(makeMolecule(p, 'ring'), { wide: [5.6, 2.4, -3], narrow: [1.9, -1.2, -3], float: 0.3, spin: 0.4 });
  }

  if (mode === 'neet') {
    const dna = makeDNA(p, { pairs: 34, radius: 0.65 });
    dna.group.rotation.z = 0.35;
    add(
      { group: wrap(dna.group), update: dna.update },
      { wide: [3.1, -0.2, -0.5], narrow: [0.4, 1, -1.5], scale: 0.8, narrowScale: 0.65 },
    );
    add(makeCell(p), { wide: [5.6, 2.2, -3], narrow: [-1.8, 3.2, -4], float: 0.2, scale: 0.9 });
    // Blood cells drift around the right half and the far edges (left half holds the headline)
    const cellSpots = [
      [1.2, 3.4, -3],
      [5.2, -2.3, -1.5],
      [1.6, -3.0, -2],
      [6.4, 0.4, -3.5],
      [-1.2, -4.3, -5],
      [-8.2, -4.4, -6],
    ];
    cellSpots.forEach((spot, i) => {
      add(makeBloodCell(p), {
        wide: spot,
        narrow: [-2 + (i % 3) * 2, i % 2 ? 3.6 : -3.4, -3 - (i % 3)],
        float: 0.3,
        spin: 0.4 + i * 0.1,
      });
    });
    add(makeMolecule(p, 'water'), { wide: [4.6, 3.1, -2], narrow: [1.8, -2, -2], float: 0.3, spin: 0.6 });
  }

  if (mode === 'school') {
    add(makeNetwork(p), { wide: [2.9, 0.1, 0], narrow: [0, 1.5, -1], narrowScale: 0.75 });
    add(makeGradCap(p), { wide: [5.5, 2.1, -1.5], narrow: [1.8, 3.4, -2], float: 0.3, spin: 0.5 });
    add(makeGradCap(p), { wide: [-8, -4.4, -6], narrow: [-1.8, -3, -3], float: 0.25, spin: 0.4, scale: 0.8 });
    add(makeBooks(p), { wide: [1.4, -3, -2], narrow: [1.6, -2.4, -2], float: 0.25, spin: 0.3 });
    add(makeBooks(p), { wide: [-1.6, -4.3, -5], narrow: [-1.8, 3.2, -4], float: 0.3, spin: 0.35 });
    add(makeMolecule(p, 'ring'), { wide: [5.4, -2.3, -2], narrow: [2, 0, -4], float: 0.2, spin: 0.4 });
  }

  return { items, updaters };
}

/** Wrap an object so its own rotation (e.g. DNA spin) is independent of placement tilt. */
function wrap(obj) {
  const g = new THREE.Group();
  const tilt = obj.rotation.z;
  obj.rotation.z = 0;
  g.rotation.z = tilt;
  g.add(obj);
  return g;
}

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => m.dispose());
  });
}

/* ------------------------------------------------------------------ entry */

export function initScene(canvas, mode = 'home') {
  const isSmallScreen = window.matchMedia('(max-width: 900px), (hover: none)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmallScreen, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('[PrepWays] WebGL unavailable, skipping 3D scene.', err);
    canvas.remove();
    return;
  }
  // Phones have 3x screens; rendering at full density makes the 3D hero stutter.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.PointLight(0xffffff, 40, 30);
  key.position.set(4, 5, 6);
  const rim = new THREE.PointLight(0x22d3ee, 25, 30);
  rim.position.set(-6, -3, 4);
  scene.add(key, rim);

  const root = new THREE.Group();
  scene.add(root);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let composition = null;
  let narrow = false;

  function layout() {
    if (!composition) return;
    composition.items.forEach((it) => {
      const [x, y, z] = narrow ? it.narrow : it.wide;
      it.base = new THREE.Vector3(x, y, z);
      it.obj.position.copy(it.base);
      it.obj.scale.setScalar((narrow ? it.narrowScale ?? it.scale : it.scale) ?? 1);
      // Off-centre hero objects (e.g. the atom) turn to face the camera so
      // their orbits never collapse into edge-on lines.
      if (it.faceCamera) it.obj.lookAt(camera.position);
    });
  }

  function build() {
    if (composition) {
      composition.items.forEach((it) => {
        root.remove(it.obj);
        disposeTree(it.obj);
      });
    }
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const p = PALETTES[theme];
    rim.color.setHex(p.secondary);
    composition = compose(mode, p);
    composition.items.forEach((it) => root.add(it.obj));
    layout();
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wasNarrow = narrow;
    narrow = camera.aspect < 1.05;
    if (wasNarrow !== narrow) layout();
    if (reduceMotion) render(2);
  }

  // Pointer parallax
  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  function render(t) {
    composition.updaters.forEach((u) => u(t));
    composition.items.forEach((it) => {
      if (it.float) it.obj.position.y = it.base.y + Math.sin(t * 0.8 + it.phase) * it.float;
      if (it.spin) {
        it.obj.rotation.x = t * it.spin * 0.6 + it.phase;
        it.obj.rotation.y = t * it.spin + it.phase;
      }
    });

    // Smooth camera drift toward pointer + gentle scroll parallax
    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    root.position.y = Math.min(window.scrollY, 1200) * 0.0025;

    renderer.render(scene, camera);
  }

  // Only animate while the canvas is visible and the tab is active
  let visible = true;
  let rafId = 0;
  const clock = new THREE.Timer();
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    clock.update(ts);
    render(clock.getElapsed());
  }
  function start() {
    if (reduceMotion || rafId || !visible || document.hidden) return;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', resize);
  window.addEventListener('prepways:themechange', () => {
    build();
    if (reduceMotion) render(2);
  });

  build();
  resize();
  if (reduceMotion) render(2);
  else start();
  canvas.classList.add('is-ready');
}
