// Moving parts of the mill engine, shared by the build (Node) and the page.
// Descriptors are drawn by drawDesc and recorded for the audit by the build.

export const RAD = Math.PI / 180;
export const GEO = {
  azimuth: 55,
  elevation: 28,
  axisZ: 42, // cylinder and crankshaft centre height
  bore: { r: 10, x0: -137, x1: -87 }, // inner bore
  barrel: { r: 16, x0: -140, x1: -84 },
  piston: { r: 9.6, thick: 6, x0: -132 }, // centre at head-end dead centre
  rodR: 2.2,
  coverOuter: -80, // crank-end cover outer face
  glandOuter: -72,
  crosshead: { half: 7, y: 6, z0: 36, z1: 48, offset: 86 }, // centre x = piston centre + offset
  pinY: [-8, 16],
  conrodY: [9, 13],
  shaft: { x: 74, r: 5 },
  crank: { r: 20, y0: 1, y1: 7, pinR: 4, pinY: [7, 9], noseY: [13, 15] },
  eccentric: { e: 2.5, r: 7, y0: 25, y1: 31, strapIn: 7.3, strapOut: 9.5 },
  valve: { len: 18, z0: 37, z1: 47, y0: 26, y1: 31, mid: -109 },
  valveRod: { r: 1.3, y: 29, z: 42, chestEnd: -92, chestInner: -94, nut: -88.8, joint: -44 },
  chest: { x0: -132, x1: -92, y0: 24, y1: 34, z0: 34, z1: 50 },
  ports: { head: [-121, -117], exhaust: [-111, -107], crank: [-101, -97], z: [38, 46] },
  flywheel: { y0: -58, y1: -46, hub: 8, rimIn: 39, rimOut: 46, spokeY: [-58, -46] },
  window: { x0: -130, x1: -94, deg0: 27, deg1: 83 },
  chestWindow: { x0: -130, x1: -94, z0: 36.5, z1: 47.5 },
  rest: 60,
};

export function partsOf(K, G, M) {
  const Z = GEO.axisZ;
  const X_AXIS = [1, 0, 0];
  const Y_AXIS = [0, 1, 0];
  const alongX = (x, y, z) => G.frameOf([x, y, z], X_AXIS, [0, 1, 0], [0, 0, 1]);
  const alongY = (x, y, z) => G.frameOf([x, y, z], Y_AXIS, [1, 0, 0], [0, 0, 1]);

  // Piston, its rod inside the bore, and the steam on both sides. Drawn inside the barrel window.
  function cylinderInside(theta) {
    const s = M.stateAt(theta);
    const xp = GEO.piston.x0 + s.piston;
    const half = GEO.piston.thick / 2;
    const F = alongX(0, 0, Z);
    const head = { kind: "steam", F, s0: GEO.bore.x0 + 0.2, s1: xp - half, r: GEO.bore.r - 0.3, bar: s.head.bar, className: "se-steam", name: "steam.head" };
    const crank = { kind: "steam", F, s0: xp + half, s1: GEO.bore.x1 - 0.2, r: GEO.bore.r - 0.3, bar: s.crank.bar, className: "se-steam", name: "steam.crank" };
    const piston = { kind: "disc", F, s0: xp - half, s1: xp + half, r: GEO.piston.r, tone: "hi", name: "motion.piston", owner: "motion", inner: [{ s: xp - half + 1.4, r: GEO.piston.r }, { s: xp + half - 1.4, r: GEO.piston.r }] };
    const rod = { kind: "disc", F, s0: xp + half, s1: GEO.bore.x1 + 3.01, r: GEO.rodR, tone: "hi", name: "motion.rod-inside", owner: "motion", crease: "none" };
    return { descs: [head, piston, crank, rod], xp };
  }

  // Crosshead, piston rod outside the gland, and the pin stubs.
  function crosshead(theta) {
    const s = M.stateAt(theta);
    const xp = GEO.piston.x0 + s.piston;
    const xc = xp + GEO.crosshead.offset;
    const C = GEO.crosshead;
    const F = alongX(0, 0, Z);
    const FB = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const pinF = alongY(xc, 0, Z);
    return {
      xc,
      descs: [
        { kind: "disc", F, s0: GEO.glandOuter, s1: xc - C.half, r: GEO.rodR, tone: "hi", name: "motion.rod-outside", owner: "motion", crease: "none" },
        { kind: "prism", F: FB, polygon: [[xc - C.half, -C.y], [xc + C.half, -C.y], [xc + C.half, C.y], [xc - C.half, C.y]], s0: C.z0, s1: C.z1, tone: "mid", name: "motion.crosshead", owner: "motion", lines: [[[xc - C.half, C.y, C.z0 + 2.5], [xc + C.half, C.y, C.z0 + 2.5]]], lineTone: "faint" },
        { kind: "disc", F: pinF, s0: GEO.pinY[0], s1: -C.y, r: 2.5, tone: "mid", name: "motion.pin", owner: "motion" },
        { kind: "disc", F: pinF, s0: C.y, s1: GEO.conrodY[0], r: 2.5, tone: "mid", name: "motion.pin", owner: "motion" },
      ],
    };
  }

  // Crankpin position for a crank angle: theta = 0 is head-end dead centre, pin toward the cylinder.
  function crankpin(theta) {
    const a = theta * RAD;
    return [GEO.shaft.x - GEO.crank.r * Math.cos(a), Z + GEO.crank.r * Math.sin(a)];
  }

  // Connecting rod: small end on the crosshead pin, big end on the crankpin, rod between.
  function conrod(theta) {
    const { xc } = crosshead(theta);
    const [xk, zk] = crankpin(theta);
    const [y0, y1] = GEO.conrodY;
    const ym = (y0 + y1) / 2;
    const small = alongY(xc, 0, Z);
    const big = alongY(xk, 0, zk);
    const axis = G.unit3([xk - xc, 0, zk - Z]);
    const span = Math.hypot(xk - xc, zk - Z);
    const FR = G.frameAlong([xc, ym, Z], axis);
    return [
      { kind: "ring", F: small, s0: y0, s1: y1, rIn: 2.5, rOut: 5, tone: "hi", name: "conrod.small-end", owner: "conrod" },
      { kind: "disc", F: FR, s0: 4.6, s1: span - 6.6, r: 2.4, tone: "hi", name: "conrod.rod", owner: "conrod", inner: [{ s: span * 0.5, r: 2.4 }] },
      { kind: "ring", F: big, s0: y0, s1: y1, rIn: GEO.crank.pinR, rOut: 7, tone: "hi", name: "conrod.big-end", owner: "conrod" },
    ];
  }

  // Crank arm and crankpin on the shaft.
  function crank(theta) {
    const [xk, zk] = crankpin(theta);
    const a = theta * RAD;
    const dirXZ = [-Math.cos(a), 0, Math.sin(a)];
    const F = G.frameOf([GEO.shaft.x, 0, Z], Y_AXIS, dirXZ, G.cross3(Y_AXIS, dirXZ));
    return [
      { kind: "prism", F, polygon: G.stadium(9.5, 6.5, GEO.crank.r), s0: GEO.crank.y0, s1: GEO.crank.y1, tone: "mid", name: "crank.arm", owner: "crank" },
      { kind: "disc", F: alongY(xk, 0, zk), s0: GEO.crank.pinY[0], s1: GEO.crank.pinY[1], r: GEO.crank.pinR, tone: "hi", name: "crank.pin", owner: "crank", bevel: 0.3 },
    ];
  }

  // Eccentric sheave, strap and rod to the valve-rod joint; the valve rod outside the chest and the joint block.
  function valveGear(theta) {
    const s = M.stateAt(theta);
    const E = GEO.eccentric;
    const a = (theta - M.ENGINE.advanceDeg) * RAD;
    const cx = GEO.shaft.x + E.e * Math.cos(a);
    const cz = Z + E.e * Math.sin(a);
    const ym = (E.y0 + E.y1) / 2;
    const xj = GEO.valveRod.joint + s.valve;
    const joint = [xj, GEO.valveRod.y, GEO.valveRod.z];
    const toJoint = G.unit3([joint[0] - cx, 0, joint[2] - cz]);
    const span = Math.hypot(joint[0] - cx, joint[2] - cz);
    const FR = G.frameAlong([cx, ym, cz], toJoint);
    const F = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
    return {
      eccentric: [
        { kind: "disc", F: alongY(cx, 0, cz), s0: E.y0, s1: E.y1, r: E.r, tone: "mid", name: "gear.sheave", owner: "gear" },
        { kind: "ring", F: alongY(cx, 0, cz), s0: E.y0 + 0.5, s1: E.y1 - 0.5, rIn: E.strapIn, rOut: E.strapOut, tone: "hi", name: "gear.strap", owner: "gear" },
        { kind: "disc", F: FR, s0: E.strapOut - 0.2, s1: span - 2.5, r: 1.4, tone: "hi", name: "gear.eccentric-rod", owner: "gear", crease: "none" },
      ],
      rod: [
        { kind: "disc", F, s0: GEO.valveRod.nut, s1: xj - 2.5, r: GEO.valveRod.r, tone: "hi", name: "gear.valve-rod", owner: "gear", crease: "none" },
        { kind: "prism", F: G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), polygon: [[xj - 2.5, GEO.valveRod.y - 2], [xj + 2.5, GEO.valveRod.y - 2], [xj + 2.5, GEO.valveRod.y + 2], [xj - 2.5, GEO.valveRod.y + 2]], s0: Z - 2.2, s1: Z + 2.2, tone: "mid", name: "gear.joint", owner: "gear" },
      ],
    };
  }

  // The slide valve inside the chest and the rod stub from it to the chest wall.
  function valve(theta) {
    const s = M.stateAt(theta);
    const V = GEO.valve;
    const x0 = V.mid - V.len / 2 + s.valve;
    const x1 = V.mid + V.len / 2 + s.valve;
    const FB = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const F = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
    return [
      { kind: "prism", F: FB, polygon: [[x0, V.y0 + 0.01], [x1, V.y0 + 0.01], [x1, V.y1], [x0, V.y1]], s0: V.z0, s1: V.z1, tone: "hi", lit: true, name: "gear.valve", owner: "gear", lines: [[[x0, V.y1, V.z0 + 2], [x1, V.y1, V.z0 + 2]], [[x0, V.y1, V.z1 - 2], [x1, V.y1, V.z1 - 2]]], lineTone: "lo" },
      { kind: "disc", F, s0: x1, s1: GEO.valveRod.chestInner - 0.01, r: GEO.valveRod.r, tone: "hi", name: "gear.valve-rod-inside", owner: "gear", crease: "none" },
    ];
  }

  // Flywheel spokes, turning with the shaft. Each is drawn as its visible faces only, and
  // sorted into the group behind the hub or in front of it by which side of the hub it roots on.
  function spokes(theta, P) {
    const W = GEO.flywheel;
    const o = K.iso([0, 0, 0], P);
    const ey = K.iso([0, 1, 0], P);
    const EY = [ey[0] - o[0], ey[1] - o[1]];
    const far = [];
    const near = [];
    for (let i = 0; i < 6; i++) {
      const a = theta * RAD + (i * Math.PI) / 3;
      const dirXZ = [-Math.cos(a), 0, Math.sin(a)];
      const d = K.iso(dirXZ, P);
      const D = [d[0] - o[0], d[1] - o[1]];
      const F = G.frameOf([GEO.shaft.x, 0, Z], Y_AXIS, dirXZ, G.cross3(Y_AXIS, dirXZ));
      const desc = { kind: "faces", F, polygon: [[W.hub - 0.01, -2.6], [W.rimIn + 0.01, -2.6], [W.rimIn + 0.01, 2.6], [W.hub - 0.01, 2.6]], s0: W.spokeY[0], s1: W.spokeY[1], tone: "mid", name: "flywheel.spoke", owner: "flywheel" };
      (D[0] * EY[0] + D[1] * EY[1] >= 0 ? far : near).push(desc);
    }
    return { far, near };
  }

  // A prism drawn face by face, with no hull fill, so a part flush against a round body
  // never paints over that body's cap where its hidden corners project.
  function facesSvg(desc, P) {
    const { F, polygon, s0, s1 } = desc;
    const Vv = G.viewOf(P);
    const at3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
    const n = polygon.length;
    const faces = [];
    for (let j = 0; j < n; j++) {
      const p0 = polygon[j];
      const p1 = polygon[(j + 1) % n];
      faces.push({ pts: [at3(s0, p0), at3(s0, p1), at3(s1, p1), at3(s1, p0)] });
    }
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
    if (desc.kind === "disc") return K.solidSvg(G.disc(desc.s0, desc.s1, desc.r, desc.F, P, desc.bevel ? { bevel: desc.bevel } : {}), { tone: desc.tone, inner, className: desc.className, crease: desc.crease ?? "faint", lit: desc.lit });
    if (desc.kind === "ring") return K.solidSvg(G.ringBand(desc.s0, desc.s1, desc.rIn, desc.rOut, desc.F, P), { tone: desc.tone, inner, className: desc.className });
    if (desc.kind === "prism") {
      const lines = (desc.lines ?? []).map(([a, b]) => K.lineSvg(K.segment(a, b, P), { tone: desc.lineTone ?? "faint" })).join("");
      return K.solidSvg(G.prismOf(desc.F, desc.polygon, desc.s0, desc.s1, P), { tone: desc.tone, className: desc.className, lit: desc.lit }) + lines;
    }
    if (desc.kind === "ball") return K.solidSvg(G.sphereOf(desc.at, desc.r, P, { steps: 28 }), { tone: desc.tone });
    if (desc.kind === "faces") return facesSvg(desc, P);
    if (desc.kind === "steam") {
      if (desc.s1 - desc.s0 < 0.2) return "";
      const paths = G.disc(desc.s0, desc.s1, desc.r, desc.F, P);
      const share = Math.min(1, Math.max(0, (desc.bar - 1.0) / 6.0));
      return `<g class="${desc.className}" style="opacity:${(0.12 + 0.78 * share).toFixed(3)}"><path class="se-steam-fill" d="${paths.fill}"/></g>`;
    }
    return "";
  }

  return { cylinderInside, crosshead, conrod, crank, valveGear, valve, spokes, crankpin, drawDesc };
}
