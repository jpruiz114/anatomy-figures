// Geometry shared by the build (Node) and the page: the parts that move.
// `partsOf(K, G)` takes the kit and lathe namespaces (module imports in Node,
// the inlined globals in the page) and returns descriptor builders. A
// descriptor is drawn by `drawDesc` and recorded for the audit by the build.

export const DEG = Math.PI / 180;
export const GEO = {
  azimuth: 40,
  elevation: 27,
  R: 18.3, // body radius, 0.1 m units
  RI: 17.8,
  exit: 10, // nozzle exit plane z
  skirt: [20, 38],
  rp1: [38, 150],
  inter: [150, 176],
  lox: [176, 376],
  istage: [376, 440],
  engineR: 12.7,
  legAngles: [40 + 45, 40 - 45, 40 + 135, 40 - 135],
  finAngles: [40, 40 + 90, 40 + 180, 40 + 270],
  leg: { hinge: [20.6, 35], length: 79.4, sweep: 114.95, strutAt: 48, pivot: [21.8, 112], ball: 1.9, barrel: 29, rod2: 40, foot: 4, footThick: 1.5, half: 3.6, thick: 1.0, root: 2.0 },
  fin: { hinge: [19.3, 424], thick: 2.5, polygon: [[-6, 0], [6, 0], [6, -11], [4.5, -14], [-4.5, -14], [-6, -11]] },
  windows: { skirt: [22, 36], rp1: [44, 146], lox: [182, 370], halfDeg: 32 },
};

export function partsOf(K, G) {
  const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
  const tang = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG), 0];
  const UP = [0, 0, 1];
  const basis = (deg) => ({ r: dir(deg), t: tang(deg) });

  // Legs. `share` is 0 stowed, 1 deployed. Returns descriptors in painter's order
  // for a near leg (strut first); a far leg reverses them.
  function leg(index, share) {
    const L = GEO.leg;
    const deg = GEO.legAngles[index];
    const { r: er, t: et } = basis(deg);
    const alpha = share * L.sweep * DEG;
    const a = G.unit3(G.add3(G.mul3(er, Math.sin(alpha)), G.mul3(UP, Math.cos(alpha))));
    const hinge = G.add3(G.mul3(er, L.hinge[0]), [0, 0, L.hinge[1]]);
    const v = G.unit3(G.cross3(a, et));
    const FL = G.frameOf(hinge, a, et, v);
    const tip = G.add3(hinge, G.mul3(a, L.length));
    const footAxis = G.unit3(G.add3(G.mul3(a, 1 - share), G.mul3(UP, share)));
    const FF = G.frameAlong(tip, footAxis);
    const pivot = G.add3(G.mul3(er, L.pivot[0]), [0, 0, L.pivot[1]]);
    const on = G.add3(G.add3(hinge, G.mul3(a, L.strutAt)), G.mul3(v, L.thick));
    const q = G.unit3(G.sub3(on, pivot));
    const span = G.len3(G.sub3(on, pivot));
    const FQ = G.frameAlong(pivot, q);
    const seat = Math.sqrt(L.ball ** 2 - 1.5 ** 2);
    const len2 = Math.max(0, Math.min(L.rod2, span - L.barrel));
    const len3 = Math.max(0, span - L.barrel - len2);
    const owner = `leg${index}`;
    const strut = [
      { kind: "disc", F: FQ, s0: seat, s1: L.barrel, r: 1.5, tone: "mid", name: `${owner}.barrel`, owner, inner: [8, 16, 24].map((s) => ({ s, r: 1.5 })) },
      ...(len2 > 0.3 ? [{ kind: "disc", F: FQ, s0: L.barrel, s1: L.barrel + len2, r: 1.1, tone: "mid", name: `${owner}.rod2`, owner }] : []),
      ...(len3 > 0.3 ? [{ kind: "disc", F: FQ, s0: L.barrel + len2, s1: span, r: 0.8, tone: "hi", name: `${owner}.rod3`, owner }] : []),
    ];
    const body = [
      { kind: "prism", F: FL, polygon: [[-L.half, -L.thick], [L.half, -L.thick], [L.half, L.thick], [-L.half, L.thick]], s0: L.root, s1: L.length, tone: "hi", name: `${owner}.leg`, owner, lines: legLines(FL, L) },
      { kind: "disc", F: FF, s0: -L.footThick, s1: 0, r: L.foot, tone: "mid", name: `${owner}.foot`, owner, bevel: 0.4 },
    ];
    return { strut, body, near: G.dot3(er, G.viewOf(P_OF(K))) > 0 };
  }

  // Two stiffener lines along the leg's outer face, edge to edge.
  function legLines(FL, L) {
    const pts = (x) => [G.pointOf2(FL, L.root, x, -L.thick), G.pointOf2(FL, L.length, x, -L.thick)];
    return [-L.half * 0.45, L.half * 0.45].map((x) => pts(x));
  }

  // Grid fins. `share` 0 stowed (folded down along the interstage), 1 deployed.
  function fin(index, share) {
    const Fn = GEO.fin;
    const deg = GEO.finAngles[index];
    const { r: er, t: et } = basis(deg);
    const theta = (1 - share) * 90 * DEG;
    const n = G.unit3(G.add3(G.mul3(er, Math.sin(theta)), G.mul3(UP, Math.cos(theta))));
    const hinge = G.add3(G.mul3(er, Fn.hinge[0]), [0, 0, Fn.hinge[1]]);
    const v = G.unit3(G.cross3(n, et));
    const F = G.frameOf(hinge, n, et, v);
    const owner = `fin${index}`;
    const lines = [];
    const xmax = (y) => (y >= -11 ? 6 : 6 - (1.5 * (-11 - y)) / 3);
    const ymin = (x) => (Math.abs(x) <= 4.5 ? -14 : -11 - (3 * (6 - Math.abs(x))) / 1.5);
    for (let k = 1; k <= 4; k++) {
      const y = (-14 * k) / 5;
      lines.push([G.pointOf2(F, Fn.thick, -xmax(y), y), G.pointOf2(F, Fn.thick, xmax(y), y)]);
    }
    for (let j = 1; j <= 4; j++) {
      const x = -6 + (12 * j) / 5;
      lines.push([G.pointOf2(F, Fn.thick, x, 0), G.pointOf2(F, Fn.thick, x, ymin(x))]);
    }
    return [{ kind: "prism", F, polygon: Fn.polygon, s0: 0, s1: Fn.thick, tone: "hi", name: `${owner}.plate`, owner, lines, lineTone: "lo" }];
  }

  // Propellant in a tank: a vertical cylinder of liquid up to `level`, built so its
  // bottom hides below the window. Returns one descriptor.
  function liquid(name, level, windowZ, className) {
    const zb = windowZ[0] - 8;
    const top = Math.min(Math.max(level, zb + 0.3), windowZ[1] + 8);
    return { kind: "cyl", cx: 0, cy: 0, r: GEO.RI - 0.2, z: zb, h: top - zb, tone: "mid", name, className, steps: 56 };
  }

  // The LOX downcomer above the RP-1 level, so it stands on the liquid's surface.
  function tubeAbove(level) {
    const z0 = Math.max(level, GEO.windows.rp1[0] - 4);
    const z1 = GEO.rp1[1] + 2;
    if (z1 - z0 < 0.3) return null;
    return { kind: "cyl", cx: 0, cy: 0, r: 2.2, z: z0, h: z1 - z0, tone: "mid", name: "tank.downcomer-above", steps: 24, crease: "none" };
  }

  // Draw one descriptor to SVG markup.
  function drawDesc(desc, P) {
    if (!desc) return "";
    if (desc.kind === "disc") {
      const paths = G.disc(desc.s0, desc.s1, desc.r, desc.F, P, desc.bevel ? { bevel: desc.bevel } : {});
      const inner = (desc.inner ?? []).map(({ s, r }) => K.lineSvg(G.arcOf(desc.F, s, r, P), { tone: "faint" })).join("");
      return K.solidSvg(paths, { tone: desc.tone, inner, className: desc.className });
    }
    if (desc.kind === "prism") {
      const paths = G.prismOf(desc.F, desc.polygon, desc.s0, desc.s1, P);
      const lines = (desc.lines ?? []).map(([a, b]) => K.lineSvg(K.segment(a, b, P), { tone: desc.lineTone ?? "faint" })).join("");
      return K.solidSvg(paths, { tone: desc.tone, className: desc.className }) + lines;
    }
    if (desc.kind === "ball") return K.solidSvg(G.sphereOf(desc.at, desc.r, P, { steps: 28 }), { tone: desc.tone, className: desc.className });
    if (desc.kind === "cyl") {
      const paths = K.cylinder(desc.cx, desc.cy, desc.r, desc.z, desc.h, P, desc.steps ?? 32);
      return K.solidSvg(paths, { tone: desc.tone, className: desc.className, crease: desc.crease ?? "faint" });
    }
    return "";
  }

  return { leg, fin, liquid, tubeAbove, drawDesc, dir, tang };
}

// G.pointOf uses (s, r, angle); parts need (s, x, y) in the frame's u, v plane.
export function installPointOf2(G) {
  if (!G.pointOf2) G.pointOf2 = (F, s, x, y) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
}

// The projection is needed to tell near legs from far ones; the build sets it.
let CURRENT_P = null;
export const setProjection = (P) => (CURRENT_P = P);
const P_OF = () => CURRENT_P;
