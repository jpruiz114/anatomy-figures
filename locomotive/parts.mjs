// Moving parts of the locomotive, shared by the build (Node) and the page.
export const RAD = Math.PI / 180;
export const GEO = {
  azimuth: 118,
  elevation: 26,
  axleZ: 45,
  axles: [-40, 120], // x of the front and rear axles
  wheel: { r: 45, tyreIn: 38, hub: 9, y0: 66, y1: 80, hubY0: 64, spokes: 10 },
  crank: { r: 20, pinR: 4.5 },
  // along y, from the wheel face outward
  couplingY: [80.1, 86],
  conrodY: [90.5, 96.5],
  returnY: [96.5, 101.5],
  tipY: [101.5, 105.5],
  cyl: { x0: -270, x1: -210, r: 16, bore: 15, y: 74, z: 45, pistonX0: -262, piston: 6, rodR: 3, coverOut: -206, glandOut: -200 },
  crosshead: { offset: 122, half: 7, y0: 70, y1: 88, z0: 36, z1: 54, pinY: [90.5, 96.5], noseY: [96.5, 99.5] },
  chest: { x0: -266, x1: -214, y0: 66, y1: 90, z0: 61, z1: 75 },
  valve: { len: 22, y0: 68, y1: 80, z0: 63, z1: 73, mid: -240 },
  valveRod: { r: 1.6, y: 84, z: 68, chestInner: -216, nut: -210.2, joint: -180, eccY: 103.5, blockY: [80, 107] },
  ports: { head: [-254, -250], exhaust: [-242, -238], crank: [-230, -226], z: [64, 72] },
  windows: { cyl: { x0: -264, x1: -216, deg0: -20, deg1: 32 }, chest: { x0: -262, x1: -218, z0: 62.5, z1: 73.5 }, boiler: { x0: -175, x1: 110, deg0: 12, deg1: 66 }, fire: { x0: 149, x1: 211, z0: 44, z1: 150 } },
  boiler: { x0: -190, x1: 135, r: 50, bore: 47, z: 110, water: 141 },
  rest: 60,
};

export function partsOf(K, G, M) {
  const Y_AXIS = [0, 1, 0];
  const X_AXIS = [1, 0, 0];
  const UP = [0, 0, 1];
  const Z = GEO.axleZ;
  const alongX = (x, y, z) => G.frameOf([x, y, z], X_AXIS, [0, 1, 0], [0, 0, 1]);
  const alongY = (x, y, z) => G.frameOf([x, y, z], Y_AXIS, [1, 0, 0], [0, 0, 1]);
  const FB = G.frameOf([0, 0, 0], UP, [1, 0, 0], [0, 1, 0]);

  // Crankpin centre on a wheel at x. theta = 0: pin toward the cylinders (front, -x).
  function pinAt(xAxle, theta) {
    const a = theta * RAD;
    return [xAxle - GEO.crank.r * Math.cos(a), Z + GEO.crank.r * Math.sin(a)];
  }

  function cylinderInside(theta) {
    const s = M.stateAt(theta);
    const C = GEO.cyl;
    const xp = C.pistonX0 + s.piston;
    const half = C.piston / 2;
    const F = alongX(0, C.y, C.z);
    return [
      { kind: "steam", F, s0: C.x0 + 3.2, s1: xp - half, r: C.bore - 0.3, bar: s.head.bar, name: "steam.head" },
      { kind: "disc", F, s0: xp - half, s1: xp + half, r: C.bore - 0.4, tone: "hi", name: "motion.piston", owner: "motion", inner: [{ s: xp - half + 1.2, r: C.bore - 0.4 }, { s: xp + half - 1.2, r: C.bore - 0.4 }] },
      { kind: "steam", F, s0: xp + half, s1: C.x1 - 3.2, r: C.bore - 0.3, bar: s.crank.bar, name: "steam.crank" },
      { kind: "disc", F, s0: xp + half, s1: C.x1 + 0.01, r: C.rodR, tone: "hi", name: "motion.rod-inside", owner: "motion", crease: "none" },
    ];
  }
  function crosshead(theta) {
    const s = M.stateAt(theta);
    const C = GEO.cyl;
    const H = GEO.crosshead;
    const xc = C.pistonX0 + s.piston + H.offset;
    const F = alongX(0, C.y, C.z);
    const pinF = alongY(xc, 0, Z);
    return {
      xc,
      descs: [
        { kind: "disc", F, s0: C.glandOut, s1: xc - H.half, r: C.rodR, tone: "hi", name: "motion.rod-outside", owner: "motion", crease: "none" },
        { kind: "prism", F: FB, polygon: [[xc - H.half, H.y0], [xc + H.half, H.y0], [xc + H.half, H.y1], [xc - H.half, H.y1]], s0: H.z0, s1: H.z1, tone: "mid", name: "motion.crosshead", owner: "motion", lines: [[[xc - H.half, H.y1, H.z0 + 3], [xc + H.half, H.y1, H.z0 + 3]], [[xc - H.half, H.y1, H.z1 - 3], [xc + H.half, H.y1, H.z1 - 3]]], lineTone: "faint" },
        { kind: "disc", F: pinF, s0: H.y1, s1: H.pinY[0], r: 2.8, tone: "mid", name: "motion.pin", owner: "motion" },
      ],
      nose: [{ kind: "disc", F: pinF, s0: H.pinY[1], s1: H.noseY[1], r: 2.8, tone: "mid", name: "motion.pin-nose", owner: "motion", bevel: 0.3 }],
    };
  }
  function conrod(theta) {
    const { xc } = crosshead(theta);
    const [xk, zk] = pinAt(GEO.axles[1], theta);
    const [y0, y1] = GEO.conrodY;
    const ym = (y0 + y1) / 2;
    const axis = G.unit3([xk - xc, 0, zk - Z]);
    const span = Math.hypot(xk - xc, zk - Z);
    const FR = G.frameAlong([xc, ym, Z], axis);
    return [
      { kind: "ring", F: alongY(xc, 0, Z), s0: GEO.crosshead.pinY[0], s1: GEO.crosshead.pinY[1], rIn: 2.8, rOut: 5.5, tone: "hi", name: "conrod.small-end", owner: "conrod" },
      { kind: "disc", F: FR, s0: 5, s1: span - 7.5, r: 2.6, tone: "hi", name: "conrod.rod", owner: "conrod", inner: [{ s: span * 0.5, r: 2.6 }] },
      { kind: "ring", F: alongY(xk, 0, zk), s0: y0, s1: y1, rIn: GEO.crank.pinR, rOut: 8, tone: "hi", name: "conrod.big-end", owner: "conrod" },
    ];
  }
  function couplingRod(theta) {
    const [xa, za] = pinAt(GEO.axles[0], theta);
    const [xb] = pinAt(GEO.axles[1], theta);
    const [y0, y1] = GEO.couplingY;
    const ym = (y0 + y1) / 2;
    return [
      { kind: "ring", F: alongY(xa, 0, za), s0: y0, s1: y1, rIn: GEO.crank.pinR, rOut: 7.5, tone: "hi", name: "coupling.front-end", owner: "coupling" },
      { kind: "disc", F: alongX(0, ym, za), s0: xa + 7.3, s1: xb - 7.3, r: 2.4, tone: "hi", name: "coupling.rod", owner: "coupling", crease: "none" },
      { kind: "ring", F: alongY(xb, 0, za), s0: y0, s1: y1, rIn: GEO.crank.pinR, rOut: 7.5, tone: "hi", name: "coupling.rear-end", owner: "coupling" },
    ];
  }
  // Crankpins: the slivers that show between the rods, and the front pin's nose.
  function pins(theta) {
    const [xa, za] = pinAt(GEO.axles[0], theta);
    const [xb, zb] = pinAt(GEO.axles[1], theta);
    return {
      front: [{ kind: "disc", F: alongY(xa, 0, za), s0: GEO.couplingY[1], s1: GEO.couplingY[1] + 3, r: GEO.crank.pinR, tone: "hi", name: "crank.front-nose", owner: "crank", bevel: 0.3 }],
      rear: [{ kind: "disc", F: alongY(xb, 0, zb), s0: GEO.couplingY[1], s1: GEO.conrodY[0], r: GEO.crank.pinR, tone: "hi", name: "crank.rear-pin", owner: "crank" }],
    };
  }
  // Return crank on the rear pin and its eccentric rod forward to the valve-rod joint.
  function valveGear(theta) {
    const s = M.stateAt(theta);
    const [xk, zk] = pinAt(GEO.axles[1], theta);
    const e = M.LOCO.valveTravel / 2;
    const a = (theta - M.LOCO.advanceDeg) * RAD;
    const tip = [GEO.axles[1] + e * Math.cos(a), Z - e * Math.sin(a)];
    const armDir = G.unit3([tip[0] - xk, 0, tip[1] - zk]);
    const armLen = Math.hypot(tip[0] - xk, tip[1] - zk);
    const AF = G.frameOf([xk, 0, zk], Y_AXIS, armDir, G.cross3(Y_AXIS, armDir));
    const [ry0, ry1] = GEO.returnY;
    const [ty0, ty1] = GEO.tipY;
    const tipY = (ty0 + ty1) / 2;
    const xj = GEO.valveRod.joint + s.valve;
    const joint = [xj + 3, GEO.valveRod.eccY, GEO.valveRod.z];
    const from = [tip[0], tipY, tip[1]];
    const dirR = G.unit3(G.sub3(joint, from));
    const span = G.len3(G.sub3(joint, from));
    const RF = G.frameAlong(from, dirR);
    const VF = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
    const [by0, by1] = GEO.valveRod.blockY;
    return {
      crank: [
        { kind: "prism", F: AF, polygon: G.stadium(7, 4.5, armLen), s0: ry0, s1: ry1, tone: "mid", name: "gear.return-crank", owner: "gear" },
        { kind: "disc", F: alongY(tip[0], 0, tip[1]), s0: ry1 - 0.01, s1: ty1, r: 3.2, tone: "hi", name: "gear.tip", owner: "gear", bevel: 0.3 },
      ],
      rod: [
        { kind: "disc", F: RF, s0: 3.2, s1: span - 0.01, r: 1.6, tone: "hi", name: "gear.eccentric-rod", owner: "gear", crease: "none" },
        { kind: "prism", F: FB, polygon: [[xj - 3, by0], [xj + 3, by0], [xj + 3, by1], [xj - 3, by1]], s0: GEO.valveRod.z - 4, s1: GEO.valveRod.z + 4, tone: "mid", name: "gear.joint", owner: "gear", lines: [[[xj - 3, by1, GEO.valveRod.z], [xj + 3, by1, GEO.valveRod.z]]], lineTone: "faint" },
        { kind: "disc", F: VF, s0: GEO.valveRod.nut, s1: xj - 3, r: GEO.valveRod.r, tone: "hi", name: "gear.valve-rod", owner: "gear", crease: "none" },
      ],
    };
  }
  function valve(theta) {
    const s = M.stateAt(theta);
    const Vv = GEO.valve;
    const x0 = Vv.mid - Vv.len / 2 + s.valve;
    const x1 = Vv.mid + Vv.len / 2 + s.valve;
    const F = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
    return [
      { kind: "prism", F: FB, polygon: [[x0, Vv.y0 + 0.01], [x1, Vv.y0 + 0.01], [x1, Vv.y1], [x0, Vv.y1]], s0: Vv.z0, s1: Vv.z1, tone: "hi", lit: true, name: "gear.valve", owner: "gear", lines: [[[x0, Vv.y1, Vv.z0 + 2.5], [x1, Vv.y1, Vv.z0 + 2.5]]], lineTone: "lo" },
      { kind: "prism", F: FB, polygon: [[x1 - 0.01, GEO.valveRod.y - 2], [x1 + 4, GEO.valveRod.y - 2], [x1 + 4, GEO.valveRod.y + 2], [x1 - 0.01, GEO.valveRod.y + 2]], s0: GEO.valveRod.z - 2, s1: GEO.valveRod.z + 2, tone: "hi", name: "gear.valve-link", owner: "gear" },
      { kind: "disc", F, s0: x1 + 3.99, s1: GEO.valveRod.chestInner - 0.01, r: GEO.valveRod.r, tone: "hi", name: "gear.valve-rod-inside", owner: "gear", crease: "none" },
    ];
  }
  // Spokes of a near-side wheel, as faces, split behind and in front of the hub.
  function spokes(xAxle, theta, P) {
    const W = GEO.wheel;
    const o = K.iso([0, 0, 0], P);
    const ey = K.iso([0, 1, 0], P);
    const EY = [ey[0] - o[0], ey[1] - o[1]];
    const far = [];
    const near = [];
    for (let i = 0; i < W.spokes; i++) {
      const a = theta * RAD + (i * 2 * Math.PI) / W.spokes;
      const d3 = [-Math.cos(a), 0, Math.sin(a)];
      const d = K.iso(d3, P);
      const D = [d[0] - o[0], d[1] - o[1]];
      const F = G.frameOf([xAxle, 0, Z], Y_AXIS, d3, G.cross3(Y_AXIS, d3));
      const desc = { kind: "faces", F, polygon: [[W.hub - 0.01, -2.2], [W.tyreIn + 0.01, -2.2], [W.tyreIn + 0.01, 2.2], [W.hub - 0.01, 2.2]], s0: W.y0 + 1.5, s1: W.y1 - 1.5, tone: "mid", name: "wheel.spoke", owner: "wheel" };
      (D[0] * EY[0] + D[1] * EY[1] >= 0 ? far : near).push(desc);
    }
    return { far, near };
  }
  function facesSvg(desc, P) {
    const { F, polygon, s0, s1 } = desc;
    const Vv = G.viewOf(P);
    const at3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
    const n = polygon.length;
    const faces = [];
    for (let j = 0; j < n; j++) faces.push({ pts: [at3(s0, polygon[j]), at3(s0, polygon[(j + 1) % n]), at3(s1, polygon[(j + 1) % n]), at3(s1, polygon[j])] });
    faces.push({ pts: polygon.map((p) => at3(s0, p)).reverse() });
    faces.push({ pts: polygon.map((p) => at3(s1, p)) });
    const out = [];
    for (const face of faces) {
      const [a, b, c] = face.pts;
      const normal = G.unit3(G.cross3(G.sub3(b, a), G.sub3(c, a)));
      if (G.dot3(normal, Vv) <= 1e-6) continue;
      const tone = G.toneOf(normal, P);
      const d = K.pathOf(face.pts.map((p) => K.iso(p, P)), true);
      out.push(tone >= 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${tone}" d="${d}"/>`);
      out.push(`<path class="iso-line iso-edge" data-tone="${desc.tone}" d="${d}"/>`);
    }
    return `<g class="iso-solid">${out.join("")}</g>`;
  }
  function drawDesc(desc, P) {
    if (!desc) return "";
    const inner = (desc.inner ?? []).map(({ s, r }) => K.lineSvg(G.arcOf(desc.F, s, r, P), { tone: "faint" })).join("");
    if (desc.kind === "disc") return K.solidSvg(G.disc(desc.s0, desc.s1, desc.r, desc.F, P, desc.bevel ? { bevel: desc.bevel } : {}), { tone: desc.tone, inner, crease: desc.crease ?? "faint", lit: desc.lit });
    if (desc.kind === "ring") return K.solidSvg(G.ringBand(desc.s0, desc.s1, desc.rIn, desc.rOut, desc.F, P), { tone: desc.tone, inner });
    if (desc.kind === "prism") {
      const lines = (desc.lines ?? []).map(([a, b]) => K.lineSvg(K.segment(a, b, P), { tone: desc.lineTone ?? "faint" })).join("");
      return K.solidSvg(G.prismOf(desc.F, desc.polygon, desc.s0, desc.s1, P), { tone: desc.tone, lit: desc.lit }) + lines;
    }
    if (desc.kind === "faces") return facesSvg(desc, P);
    if (desc.kind === "steam") {
      if (desc.s1 - desc.s0 < 0.2) return "";
      const paths = G.disc(desc.s0, desc.s1, desc.r, desc.F, P);
      const share = Math.min(1, Math.max(0, (desc.bar - 1.0) / 10.5));
      return `<g class="lc-steam" style="opacity:${(0.12 + 0.78 * share).toFixed(3)}"><path class="lc-steam-fill" d="${paths.fill}"/></g>`;
    }
    return "";
  }
  return { pinAt, cylinderInside, crosshead, conrod, couplingRod, pins, valveGear, valve, spokes, drawDesc };
}
