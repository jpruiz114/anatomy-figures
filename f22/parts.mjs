// Moving surfaces of the F-22, shared by the build and the page. Units: 0.1 m.
export const RAD = Math.PI / 180;
export const GEO = {
  azimuth: 50,
  elevation: 30,
  cz: 36, // fuselage centreline height
  nacelleY: 13,
  nacelleR: 11,
  deck: { z0: 46.16, z1: 48.2, y: 23.16 },
  boom: { x0: 56, x1: 96, y0: 23.16, y1: 27, z0: 33, z1: 45 },
  nozzle: { hinge: 84, length: 12, halfWidth: 6, halfGap: 6, converge: 8, thick: 0.9 },
  stab: { hingeX: 76, z: 39, polygon: [[27, -16], [46, -4], [46, 3], [27, 9]], thick: 2.2 },
  fin: { rootX: 58, rootY: 25.64, rootTop: 46.2, chordRoot: 32, height: 25, tipFrom: 16, tipTo: 26, rudderChord: 6, thick: 1.6, gap: 0.6 },
  wing: { z: 31.8, thick: 2.4, le: [[-38, 23.16], [25, 68]], te: [[40, 68], [55, 23.16]], flapChord: 8, flaperon: [26, 46], aileron: [48, 66] },
  rotors: [
    { x: -5, width: 3.6, r: 7.4, blades: 14, speed: 1 },
    { x: 7.4, width: 1.6, r: 6.2, blades: 22, speed: 1.6 },
    { x: 10.4, width: 1.6, r: 6.0, blades: 22, speed: 1.6 },
    { x: 13.4, width: 1.6, r: 5.8, blades: 22, speed: 1.6 },
    { x: 16.4, width: 1.6, r: 5.6, blades: 22, speed: 1.6 },
  ],
  windows: {
    fan: { x0: -6.6, x1: 2.6, deg0: -12, deg1: 86, r: 8.1627, bore: 7.6 },
    comp: { x0: 5.6, x1: 18, deg0: -12, deg1: 86, r: 7.0, bore: 6.4 },
  },
  rest: { pitch: 0.35, roll: 0.25, rudder: 0, throttle: "afterburner" },
};

export function partsOf(K, G, M) {
  const UP = [0, 0, 1];
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const rot = (v, axis, deg) => {
    // Rodrigues rotation of v about unit axis by deg
    const a = deg * RAD;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const k = G.unit3(axis);
    return G.add3(G.add3(G.mul3(v, c), G.mul3(G.cross3(k, v), s)), G.mul3(k, G.dot3(k, v) * (1 - c)));
  };
  // A thin plate: origin on its hinge axis, u along the axis, v across the plate (aft/outward),
  // normal n = u x v; the polygon is in (u, v). Rotating about the hinge by `deg` turns v and n.
  function plate(origin, hingeDir, acrossDir, polygon, thick, deg, meta) {
    const u = G.unit3(hingeDir);
    const v = G.unit3(rot(acrossDir, u, deg));
    const n = G.unit3(G.cross3(u, v));
    const F = G.frameOf(origin, n, u, v);
    return { kind: "prism", F, polygon, s0: -thick / 2, s1: thick / 2, ...meta };
  }
  // The hinge knuckle: a cylinder along the axis that touches the fixed face and the plate.
  const knuckle = (origin, hingeDir, u0, u1, r, meta) => ({ kind: "disc", F: G.frameAlong(origin, hingeDir), s0: u0, s1: u1, r, tone: "mid", ...meta });

  function stabilators(s) {
    const S = GEO.stab;
    const out = [];
    for (const side of [1, -1]) {
      const deg = side > 0 ? s.stab.right : s.stab.left;
      const polygon = S.polygon.map(([y, x]) => [side * y, x]);
      // trailing edge down positive: the aft direction tips down by deg about the y axis
      const aft = [Math.cos(deg * RAD), 0, -Math.sin(deg * RAD)];
      out.push(plate([S.hingeX, 0, S.z], Y, aft, polygon, S.thick, 0, { tone: "hi", name: `stab.${side > 0 ? "right" : "left"}`, owner: "stab", lines: stabLines(side, deg) }));
    }
    return out;
  }
  function stabLines(side, deg) {
    const S = GEO.stab;
    const aft = [Math.cos(deg * RAD), 0, -Math.sin(deg * RAD)];
    const n = G.unit3(G.cross3(Y, aft));
    const at = (y, v) => G.add3(G.add3([S.hingeX, side * y, S.z], G.mul3(aft, v)), G.mul3(n, -(S.thick / 2 + 0.01)));
    const edge = (y) => -16 + ((y - 27) / 19) * 12; // leading edge v at this span
    const trail = (y) => 9 - ((y - 27) / 19) * 6;
    return [[at(33, edge(33)), at(33, trail(33))], [at(40, edge(40)), at(40, trail(40))]];
  }

  // The fin's frame and its hinge line, shared by the fixed fin, the fairing and the rudder.
  function finOf(side) {
    const Fn = GEO.fin;
    const cant = M.F22.finCantDeg * RAD;
    const up = [0, side * Math.sin(cant), Math.cos(cant)];
    const n = G.unit3(G.cross3(X, up));
    const root = [Fn.rootX, side * Fn.rootY, Fn.rootTop];
    const teRoot = G.add3(root, G.mul3(X, Fn.chordRoot));
    const teTip = G.add3(G.add3(root, G.mul3(X, Fn.tipTo)), G.mul3(up, Fn.height));
    const hingeDir = G.unit3(G.sub3(teTip, teRoot));
    const acrossRaw = G.unit3(G.cross3(n, hingeDir));
    const across = G.dot3(acrossRaw, X) > 0 ? acrossRaw : G.mul3(acrossRaw, -1);
    const a = G.dot3(across, up);
    const h = G.dot3(hingeDir, up);
    const face = G.sub3(teRoot, G.mul3(across, Fn.rudderChord)); // the fin's trailing face
    const axis = G.add3(face, G.mul3(across, Fn.thick / 2)); // the rudder hinge axis
    const faceAt = (upAt) => G.add3(face, G.mul3(hingeDir, (upAt + Fn.rudderChord * a) / h));
    return { up, n, root, hingeDir, across, a, h, face, axis, faceAt, F: G.frameOf(root, n, X, up) };
  }
  function finPolygon(side) {
    const Fn = GEO.fin;
    const f = finOf(side);
    const pR = f.faceAt(0);
    const pT = f.faceAt(Fn.height);
    return { F: f.F, polygon: [[0, 0], [G.dot3(G.sub3(pR, f.root), X), 0], [G.dot3(G.sub3(pT, f.root), X), Fn.height], [Fn.tipFrom, Fn.height]] };
  }
  // The root fairing on the boom: a prism along x whose top mates the canted fin's bottom face.
  function finFairing(side) {
    const Fn = GEO.fin;
    const B = GEO.boom;
    const f = finOf(side);
    const c1 = G.add3(f.root, G.mul3(f.n, Fn.thick / 2));
    const c2 = G.sub3(f.root, G.mul3(f.n, Fn.thick / 2));
    const low = c1[2] < c2[2] ? c1 : c2;
    const high = c1[2] < c2[2] ? c2 : c1;
    const inboard = side * (B.y0 + 0.45);
    const outboard = side * B.y1;
    const polygon = [[inboard, B.z1], [outboard, B.z1], [low[1], low[2]], [high[1], high[2]], [side * (Math.abs(high[1]) - 1.0), high[2]]];
    return { polygon: side > 0 ? polygon : polygon.slice().reverse() };
  }
  function rudders(s) {
    const Fn = GEO.fin;
    const out = [];
    for (const side of [1, -1]) {
      const f = finOf(side);
      const t = Fn.thick / 2;
      const inner = Fn.rudderChord - t; // the trailing edge, measured from the axis
      const uOf = (upAt, v) => (upAt + (Fn.rudderChord - t) * f.a - v * f.a) / f.h;
      const uA = uOf(Fn.gap, t);
      const uD = uOf(Fn.height - Fn.gap, t);
      const polygon = [[uA, t], [uOf(Fn.gap, inner), inner], [uOf(Fn.height - Fn.gap, inner), inner], [uD, t]];
      const name = side > 0 ? "right" : "left";
      out.push(knuckle(f.axis, f.hingeDir, uA, uD, t, { name: `rudder.knuckle-${name}`, owner: "rudder" }));
      out.push(plate(f.axis, f.hingeDir, f.across, polygon, Fn.thick, -side * s.rudder, { tone: "hi", name: `rudder.${name}`, owner: "rudder" }));
    }
    return out;
  }

  // Trailing-edge surfaces on each wing, hinged on knuckles along the shifted trailing edge.
  function wingFlaps(s) {
    const Wg = GEO.wing;
    const out = [];
    const t = Wg.thick / 2;
    for (const side of [1, -1]) {
      const te0 = [Wg.te[1][0], side * Wg.te[1][1]]; // root
      const te1 = [Wg.te[0][0], side * Wg.te[0][1]]; // tip
      const dir = G.unit3([te1[0] - te0[0], te1[1] - te0[1], 0]);
      const fwd = G.unit3(G.cross3(dir, UP));
      const inward = G.dot3(fwd, X) < 0 ? fwd : G.mul3(fwd, -1);
      const aft = G.mul3(inward, -1);
      const span = G.len3([te1[0] - te0[0], te1[1] - te0[1], 0]);
      for (const [name, range, deg] of [["flaperon", Wg.flaperon, side > 0 ? s.flap.right : s.flap.left], ["aileron", Wg.aileron, side > 0 ? s.aileron.right : s.aileron.left]]) {
        const t0 = (range[0] - Wg.te[1][1]) / (Wg.te[0][1] - Wg.te[1][1]);
        const t1 = (range[1] - Wg.te[1][1]) / (Wg.te[0][1] - Wg.te[1][1]);
        // the wing's trailing face is flapChord inward of the planform edge; the axis sits t behind it
        const axis = G.add3([te0[0], te0[1], Wg.z + t], G.add3(G.mul3(dir, t0 * span), G.mul3(inward, Wg.flapChord - t)));
        const length = (t1 - t0) * span;
        const polygon = [[0, t], [length, t], [length, Wg.flapChord - t], [0, Wg.flapChord - t]];
        const hinge = side > 0 ? dir : G.mul3(dir, -1);
        const rootAt = side > 0 ? axis : G.add3(axis, G.mul3(dir, length));
        const id = `${name}-${side > 0 ? "right" : "left"}`;
        out.push(knuckle(rootAt, hinge, 0, length, t, { name: `wing.knuckle-${id}`, owner: "wing" }));
        out.push(plate(rootAt, hinge, aft, polygon, Wg.thick, side > 0 ? deg : -deg, { tone: "hi", name: `wing.${id}`, owner: "wing" }));
      }
    }
    return out;
  }

  // Nozzle flaps: upper and lower on each engine, converging, vectored together.
  function nozzleFlaps(s) {
    const N = GEO.nozzle;
    const t = N.thick / 2;
    const out = [];
    for (const side of [1, -1]) {
      const cy = side * GEO.nacelleY;
      for (const [name, which] of [["upper", 1], ["lower", -1]]) {
        const tilt = which > 0 ? N.converge - s.nozzle : -N.converge - s.nozzle; // degrees below +x
        const axis = [N.hinge + t, cy, GEO.cz + which * N.halfGap];
        const aft = [Math.cos(tilt * RAD), 0, -Math.sin(tilt * RAD)];
        const id = `${name}-${side > 0 ? "right" : "left"}`;
        const mid = G.add3(axis, G.mul3(aft, N.length * 0.55));
        out.push(knuckle(axis, Y, -N.halfWidth, N.halfWidth, t, { name: `nozzle.knuckle-${id}`, owner: "nozzle" }));
        out.push(plate(axis, Y, aft, [[-N.halfWidth, t], [N.halfWidth, t], [N.halfWidth, N.length], [-N.halfWidth, N.length]], N.thick, 0, { tone: "hi", name: `nozzle.${id}`, owner: "nozzle", faceLines: [[G.add3(mid, [0, -N.halfWidth, 0]), G.add3(mid, [0, N.halfWidth, 0])]], lineTone: "faint" }));
      }
    }
    return out;
  }
  // Exit centre and direction of each plume.
  function plumeOf(s, side) {
    const N = GEO.nozzle;
    const v = s.nozzle * RAD;
    const dir = [Math.cos(v), 0, Math.sin(v)];
    const exit = G.add3([N.hinge, side * GEO.nacelleY, GEO.cz], G.mul3(dir, N.length));
    return { exit, dir };
  }

  // A rounded window on a cylinder along x, as screen points; angles from +y toward +z.
  function windowPoints(cy, cz, r, x0, x1, deg0, deg1, P) {
    const corner = 2.2;
    const arc0 = r * deg0 * RAD;
    const arc1 = r * deg1 * RAD;
    const pts = [];
    const cornerPts = (ca, cz2, start) => {
      for (let i = 0; i <= 6; i++) {
        const a = start + (i / 6) * (Math.PI / 2);
        pts.push([ca + corner * Math.cos(a), cz2 + corner * Math.sin(a)]);
      }
    };
    cornerPts(x1 - corner, arc1 - corner, 0);
    cornerPts(x0 + corner, arc1 - corner, Math.PI / 2);
    cornerPts(x0 + corner, arc0 + corner, Math.PI);
    cornerPts(x1 - corner, arc0 + corner, 1.5 * Math.PI);
    return pts.map(([x, arc]) => K.iso([x, cy + r * Math.cos(arc / r), cz + r * Math.sin(arc / r)], P));
  }
  // Clip the screen segment a-b to a convex screen polygon (Cyrus-Beck). Returns null when outside.
  function clipToPolygon(a, b, poly) {
    let t0 = 0;
    let t1 = 1;
    const d = [b[0] - a[0], b[1] - a[1]];
    const n = poly.length;
    let area = 0;
    for (let i = 0; i < n; i++) area += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const e = [q[0] - p[0], q[1] - p[1]];
      const nrm = [sign * e[1], -sign * e[0]]; // outward normal
      const num = nrm[0] * (a[0] - p[0]) + nrm[1] * (a[1] - p[1]);
      const den = nrm[0] * d[0] + nrm[1] * d[1];
      if (Math.abs(den) < 1e-9) {
        if (num > 0) return null;
        continue;
      }
      const t = -num / den;
      if (den < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return null;
    }
    return [[a[0] + d[0] * t0, a[1] + d[1] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1]];
  }
  // Blade tips on the rims of the rotor discs, seen edge-on through a window, as clipped lines.
  function rotorBlades(rows, phaseDeg, window, P) {
    const V = G.viewOf(P);
    const F = G.frameOf([0, GEO.nacelleY, GEO.cz], X, Y, UP);
    const out = [];
    for (const row of rows) {
      for (let i = 0; i < row.blades; i++) {
        const a = (phaseDeg * row.speed + (i * 360) / row.blades) * RAD;
        const normal = [0, Math.cos(a), Math.sin(a)];
        const facing = G.dot3(normal, V);
        if (facing < 0.08) continue;
        const p0 = K.iso(G.pointOf(F, row.x - row.width / 2, row.r + 0.02, a), P);
        const p1 = K.iso(G.pointOf(F, row.x + row.width / 2, row.r + 0.02, a), P);
        const seg = clipToPolygon(p0, p1, window);
        if (!seg) continue;
        if (Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) < 0.6) continue;
        out.push(K.lineSvg(`M${seg[0][0].toFixed(2)} ${seg[0][1].toFixed(2)}L${seg[1][0].toFixed(2)} ${seg[1][1].toFixed(2)}`, { tone: facing > 0.5 ? "mid" : "faint" }));
      }
    }
    return out.join("");
  }

  function drawDesc(desc, P) {
    if (!desc) return "";
    if (desc.kind === "prism") {
      // faceLines sit on the plate's mid-plane; lift them onto whichever face looks at the camera
      const sign = G.dot3(desc.F.a, G.viewOf(P)) > 0 ? 1 : -1;
      const lift = G.mul3(desc.F.a, sign * (desc.s1 + 0.01));
      const onFace = (desc.faceLines ?? []).map(([a, b]) => [G.add3(a, lift), G.add3(b, lift)]);
      const lines = [...(desc.lines ?? []), ...onFace].map(([a, b]) => K.lineSvg(K.segment(a, b, P), { tone: desc.lineTone ?? "faint" })).join("");
      return K.solidSvg(G.prismOf(desc.F, desc.polygon, desc.s0, desc.s1, P), { tone: desc.tone, lit: desc.lit, className: desc.className }) + lines;
    }
    if (desc.kind === "disc") return K.solidSvg(G.disc(desc.s0, desc.s1, desc.r, desc.F, P), { tone: desc.tone });
    return "";
  }
  return { stabilators, rudders, wingFlaps, nozzleFlaps, plumeOf, finOf, finPolygon, finFairing, windowPoints, clipToPolygon, rotorBlades, drawDesc, rot };
}
