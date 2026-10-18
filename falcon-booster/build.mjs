import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { glCamera } from "../kit/gl.mjs";
import { kitScript, glScript } from "../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, DEG, partsOf, installPointOf2, setProjection } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 820;
const H = 1060;
const { R: BR, RI, exit: EXIT } = GEO;
const AZ = GEO.azimuth;
const TOP = GEO.istage[1];

const GX = { ...G };
installPointOf2(GX);
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
const tang = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG), 0];
const on = (deg, r, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];

const APRON = { x: -132, y: -132, w: 264, d: 264, r: 18 };
const PAD = { x: -108, y: -108, w: 216, d: 216, r: 12 };
const APRON_Z = [-9, -5];
const PAD_Z = [-5, 0];

const P = k.fitProjection(
  [
    ...k.boxCorners(APRON, APRON_Z[0], 0),
    [0, 0, TOP + 2],
    ...GEO.finAngles.map((deg) => on(deg, 34, TOP - 12)),
    ...GEO.legAngles.map((deg) => on(deg, 96, 0)),
  ],
  W,
  H,
  { pad: 30, azimuth: AZ, elevation: GEO.elevation },
);
setProjection(P);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const BODY = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const parts = partsOf(k, GX);

const R = A.recorder(P);
const { items, nameFor } = R;
const record = R.solid;
function put(ref, svg, { bias = 0, shapes = [], name, dyn, engine } = {}) {
  R.put({ at: ref, bias, svg, shapes, name: name ?? nameFor("item"), dyn, engine });
}

function turned(F, profile, style = {}, { extra = "", inner = "", bias = 0, name, owner, bevel = 0, smooth, steps, rims } = {}) {
  const auto = profile.some((point) => point[2]);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth ? { smooth } : auto ? {} : { smooth: false }), ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? `turned${Math.round(profile[0][0])}`);
  const shape = record(A.solid(F, profile, { name: id, owner, curve: auto && !smooth?.slope ? profile : undefined }));
  put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [shape] });
  return shape;
}

function boxOn(deg, r0, r1, half, z0, z1, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0 } = {}) {
  const F = G.frameOf([0, 0, 0], [0, 0, 1], dir(deg), tang(deg));
  const polygon = [[r0, -half], [r1, -half], [r1, half], [r0, half]];
  const id = nameFor(name ?? "box");
  const centre = G.add3(G.mul3(dir(deg), (r0 + r1) / 2), [0, 0, (z0 + z1) / 2]);
  put(centre, S(G.prismOf(F, polygon, z0, z1, P), { tone }) + extra, { bias, name: id, shapes: [record(A.prism(F, polygon, z0, z1, { name: id, owner }))] });
  return centre;
}

// Record and draw a descriptor from parts.mjs.
function shapeOf(desc) {
  if (desc.kind === "disc") return A.disc(desc.F, desc.s0, desc.s1, desc.r, { name: desc.name, owner: desc.owner });
  if (desc.kind === "prism") return A.prism(desc.F, desc.polygon, desc.s0, desc.s1, { name: desc.name, owner: desc.owner });
  if (desc.kind === "ball") return A.ball(desc.at, desc.r, { name: desc.name, owner: desc.owner });
  if (desc.kind === "cyl") return A.cylinder(desc.cx, desc.cy, desc.r, desc.z, desc.h, { name: desc.name, owner: desc.owner });
  return null;
}
function putDescs(descs, ref, { bias = 0, name, dyn }) {
  const svg = descs.map((desc) => parts.drawDesc(desc, P)).join("");
  put(ref, svg, { bias, name, dyn, shapes: descs.map((desc) => record(shapeOf(desc))) });
}

// ---------------------------------------------------------------- pad (back SVG)
const back = [];
back.push(`<g class="fb-ground">`);
back.push(`<path class="iso-halo" d="${k.haloOf(APRON, APRON_Z[0], APRON_Z[1] - APRON_Z[0], P)}"/>`);
back.push(S(k.slabOf(APRON, APRON_Z[0], APRON_Z[1] - APRON_Z[0], P, 10, 1), { tone: "lo" }));
record(A.slab(APRON, APRON_Z[0], APRON_Z[1] - APRON_Z[0], { name: "stand.apron" }, 10));
back.push(S(k.slabOf(PAD, PAD_Z[0], PAD_Z[1] - PAD_Z[0], P, 8, 1.4), { tone: "mid" }));
record(A.slab(PAD, PAD_Z[0], PAD_Z[1] - PAD_Z[0], { name: "stand.pad" }, 8));
back.push(Ln(k.planOutline(k.insetPlan(PAD, 6), 0, P), { tone: "lo" }));
// expansion joints, edge to edge
for (const c of [-36, 36]) {
  back.push(Ln(k.lineOnTop([c, PAD.y], [c, PAD.y + PAD.d], 0, P), { tone: "faint" }));
  back.push(Ln(k.lineOnTop([PAD.x, c], [PAD.x + PAD.w, c], 0, P), { tone: "faint" }));
}
// landing circle and cross
back.push(Ln(k.ring(0, 0, 62, 0, P, 96), { tone: "mid" }));
back.push(Ln(k.ring(0, 0, 58, 0, P, 96), { tone: "lo" }));
const X_R = 58 / Math.SQRT2;
back.push(Ln(k.lineOnTop([-X_R, -X_R], [X_R, X_R], 0, P) + k.lineOnTop([-X_R, X_R], [X_R, -X_R], 0, P), { tone: "mid" }));
back.push(Ln(k.ring(0, 0, 8, 0, P, 32), { tone: "mid" }));
// tie-down rings at the pad corners
const TIES = k.corners(PAD, 14);
back.push(Ln(TIES.map(([x, y]) => k.ring(x, y, 3, 0, P, 20)).join(""), { tone: "lo" }));
back.push(Dots(TIES.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
// ruler strip along the near x edge
const STRIP = { x: -100, y: PAD.y + PAD.d - 11, w: 200, d: 6, r: 0.8 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x, STRIP.x + STRIP.w, 10, 5, STRIP.y + 0.8, 0.6, [1.8, 3.6], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3, 0.6])], { size: 0.45 }));
// label plate
const LABEL = { x: PAD.x + PAD.w - 24, y: -70, w: 12, d: 52, r: 1.4 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 7.2, LABEL.y + LABEL.d - 5], 1, P, "y"), "LZ-1", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1].map((row) => k.onTop([[LABEL.x + 3 + row * 2.2, LABEL.y + 5], [LABEL.x + 3 + row * 2.2, LABEL.y + (row ? 14 : 20)]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w / 2, LABEL.y + 2.6, 1]), at([LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d - 2.6, 1])], { size: 0.45 }));
// perimeter lights on the apron corners
const LIGHTS = k.corners(APRON, 14).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of LIGHTS) {
  back.push(S(k.cylinder(x, y, 2.4, APRON_Z[1], 1.2, P, 20), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 1.1, APRON_Z[1] + 1.2, 9, P, 16), { tone: "mid", crease: "none" }));
  back.push(S(k.cylinder(x, y, 1.9, APRON_Z[1] + 10.2, 1.6, P, 20, 0.3), { tone: "mid" }));
  back.push(Dots([at([x, y, APRON_Z[1] + 11.8])], { size: 0.5, tone: "hi" }));
  record(A.cylinder(x, y, 2.4, APRON_Z[1], 11.8, { name: "stand.light" }));
}
// scorch halo under the engines, driven live
back.push(`<path class="iso-halo fb-scorch" d="${k.haloOf({ x: -30, y: -30, w: 60, d: 60, r: 30 }, 0, 0.1, P)}"/>`);
back.push(`</g>`);

// ---------------------------------------------------------------- windows
const WIN_HALF = GEO.windows.halfDeg;
function windowPoints(z0, z1, half = WIN_HALF, r = BR, corner = 4) {
  const arc = (BR * half * DEG);
  const pts = [];
  const cornerPts = (cx, cz, a0) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + corner * Math.cos(a), cz + corner * Math.sin(a)]);
    }
  };
  cornerPts(arc - corner, z1 - corner, 0);
  cornerPts(-arc + corner, z1 - corner, Math.PI / 2);
  cornerPts(-arc + corner, z0 + corner, Math.PI);
  cornerPts(arc - corner, z0 + corner, 1.5 * Math.PI);
  return pts.map(([s, z]) => on(AZ + (s / BR) / DEG, r, z));
}
let clipCount = 0;
function windowOf(z0, z1, inside, { frames = [], stringers = true } = {}) {
  const outer = windowPoints(z0, z1);
  const path = k.pathOf(outer.map(at), true);
  const id = `fb-win${clipCount++}`;
  const body = [];
  body.push(`<path class="fb-cavity" d="${path}"/>`);
  // far inner wall: ring frames and stringers
  for (const z of frames) body.push(Ln(G.arcOf(BODY, z, RI, P, { inward: true, least: -1 }), { tone: "lo" }));
  if (stringers) {
    // vertical lines on the far inner wall, cut exactly where they meet the window's outline on screen
    const screen = outer.map(at);
    const spanAt = (x) => {
      const ys = [];
      for (let i = 0; i < screen.length; i++) {
        const [x0, y0] = screen[i];
        const [x1, y1] = screen[(i + 1) % screen.length];
        if ((x0 <= x && x1 > x) || (x1 <= x && x0 > x)) ys.push(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
      }
      return ys.length >= 2 ? [Math.min(...ys), Math.max(...ys)] : null;
    };
    for (const d of [-26, -13, 0, 13, 26]) {
      const [x] = at(on(AZ + 180 + d, RI, z0));
      const span = spanAt(x);
      if (span) body.push(Ln(k.pathOf([[x, span[0]], [x, span[1]]]), { tone: "faint" }));
    }
  }
  body.push(inside);
  return `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${body.join("")}</g><path class="iso-line fb-cut" data-tone="lo" d="${path}"/>`;
}

// ---------------------------------------------------------------- engines
const ENGINES = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [GEO.engineR * Math.cos((AZ + i * 45) * DEG), GEO.engineR * Math.sin((AZ + i * 45) * DEG)])];
const bell = (s) => 1.45 + 3.05 * Math.pow(Math.max(0, 1 - s / 11), 1.7);
const bellSlope = (s) => (s >= 11 ? 0 : (-3.05 * 1.7 * Math.pow(1 - s / 11, 0.7)) / 11);
const BELL = Array.from({ length: 23 }, (_, i) => {
  const s = (11 * i) / 22;
  return [s, bell(s), i && i < 22 ? 1 : 0];
});
const engineFrame = ([x, y]) => G.frameOf([x, y, EXIT], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ENGINE_SHAPES = [];
// bells, below the heat shield: one item each
ENGINES.forEach(([x, y], index) => {
  const F = engineFrame([x, y]);
  const owner = `engine${index}`;
  const paths = G.solidOf(BELL, F, P, { smooth: { slope: bellSlope, rows: 5 }, steps: 40, rims: "all" });
  const lip = G.arcOf(F, 0, bell(0), P, { least: -0.05 });
  const inner = Ln(G.arcOf(F, 3.2, bell(3.2), P, { slope: bellSlope(3.2) }) + G.arcOf(F, 7, bell(7), P, { slope: bellSlope(7) }), { tone: "faint" });
  const svg = S(paths, { tone: "hi", inner, className: "fb-bell" }) + `<path class="fb-void" d="${G.circleOf(F, 0, bell(0) - 0.35, P)}"/>` + Ln(G.arcOf(F, 0, bell(0) - 0.35, P, { inward: true, least: -1 }), { tone: "lo" }) + `<path class="iso-line fb-lip" data-tone="hi" data-engine="${index}" d="${lip}"/>`;
  put([x, y, EXIT + 5], svg, { name: `${owner}.bell`, engine: index, shapes: [record(A.solid(F, BELL, { name: `${owner}.bell`, owner }))] });
  ENGINE_SHAPES.push({ F, owner, index });
});
// chambers, pumps and gimbals above the shield, inside the skirt window (static, clipped)
const CHAMBER = [[11, 1.45], [12, 1.9, 1], [13.2, 2.1], [17.5, 2.1]];
const INJECTOR = [[17.5, 2.6], [19.5, 2.6]];
const DOME = [[19.5, 2.4], [20.4, 2.1, 1], [21.4, 1.5], [22.4, 1.5]];
const skirtInside = [];
const SKIRT_ORDER = [0, 1, 2, 8, 3, 7].map((i) => ({ i, depth: k.depthOf([ENGINES[i][0], ENGINES[i][1], 30], P) })).sort((a, b) => a.depth - b.depth);
const skirtShapes = [];
for (const { i } of SKIRT_ORDER) {
  const { F, owner } = ENGINE_SHAPES[i];
  const seams = [14.5, 16].map((s) => G.arcOf(F, s, 2.1, P)).join("");
  skirtInside.push(S(G.solidOf(CHAMBER, F, P, { steps: 28 }), { tone: "hi", inner: Ln(seams, { tone: "faint" }) }));
  skirtInside.push(S(G.solidOf(INJECTOR, F, P, { steps: 28 }), { tone: "hi" }) + Dots(G.dotsOf(F, 19.5, 2.2, 10, P, { fade: [0.04, 0.42] }), { size: 0.34, tone: "mid" }));
  skirtInside.push(S(G.solidOf(DOME, F, P, { steps: 28 }), { tone: "hi" }));
  skirtInside.push(S(G.sphereOf(G.pointOf(F, 23.4, 0, 0), 1.7, P, { steps: 28 }), { tone: "mid" }));
  skirtInside.push(S(G.disc(24.6, 28, 1.2, F, P), { tone: "mid" }));
  skirtShapes.push(record(A.solid(F, CHAMBER, { name: `${owner}.chamber`, owner })), record(A.solid(F, INJECTOR, { name: `${owner}.injector`, owner })), record(A.solid(F, DOME, { name: `${owner}.dome`, owner })), record(A.ball(G.pointOf(F, 23.4, 0, 0), 1.7, { name: `${owner}.gimbal`, owner })), record(A.disc(F, 24.6, 28, 1.2, { name: `${owner}.post`, owner })));
  // turbopump on the outboard side (centre engine: toward the viewer)
  const out = i === 0 ? dir(AZ) : G.unit3([ENGINES[i][0], ENGINES[i][1], 0]);
  const PF = G.frameAlong(G.add3(F.o, G.mul3(out, 3.9)), [0, 0, 1]);
  skirtInside.push(S(G.solidOf([[13.5, 1.0], [14.2, 1.5], [19.6, 1.5], [20.3, 1.0]], PF, P, { steps: 24 }), { tone: "mid", inner: Ln(G.arcOf(PF, 17, 1.5, P), { tone: "faint" }) }));
  skirtShapes.push(record(A.solid(PF, [[13.5, 1.0], [14.2, 1.5], [19.6, 1.5], [20.3, 1.0]], { name: `${owner}.pump`, owner })));
  // a short link from pump to chamber
  const link = G.frameAlong(G.pointOf(PF, 17, 0, 0), G.mul3(out, -1));
  skirtInside.push(S(G.disc(1.5, 3.9 - 2.1 + 0.05, 0.55, link, P), { tone: "mid" }));
  skirtShapes.push(record(A.disc(link, 1.5, 3.9 - 2.1 + 0.05, 0.55, { name: `${owner}.link`, owner })));
}
for (const i of [4, 5, 6]) {
  // far engines: still record their upper parts so nothing is drawn without a shape
  const { F, owner } = ENGINE_SHAPES[i];
  skirtShapes.push(record(A.solid(F, CHAMBER, { name: `${owner}.chamber`, owner })), record(A.solid(F, INJECTOR, { name: `${owner}.injector`, owner })), record(A.solid(F, DOME, { name: `${owner}.dome`, owner })), record(A.ball(G.pointOf(F, 23.4, 0, 0), 1.7, { name: `${owner}.gimbal`, owner })), record(A.disc(F, 24.6, 28, 1.2, { name: `${owner}.post`, owner })));
}

// ---------------------------------------------------------------- body
const SKIN = { owner: "body" };
function skinBand(z0, z1, tone, { name, seams = [], window = "", bias = 0, extra = "", dyn } = {}) {
  const id = nameFor(name);
  const paths = G.solidOf([[z0, BR], [z1, BR]], BODY, P, { steps: 64, smooth: false, rims: "all" });
  const inner = Ln(seams.map((s) => G.arcOf(BODY, s, BR, P)).join(""), { tone: "faint" });
  put([0, 0, (z0 + z1) / 2], S(paths, { tone, inner }) + window + extra, { bias, name: id, dyn, shapes: [record(A.ring(BODY, z0, z1, RI, BR, { name: id, ...SKIN }))] });
}
// skirt with the engine window
skinBand(GEO.skirt[0], GEO.skirt[1], "hi", { name: "body.skirt", window: windowOf(GEO.windows.skirt[0], GEO.windows.skirt[1], skirtInside.join(""), { frames: [26, 32], stringers: false }) });
// shapes drawn inside the skirt window belong to the skirt item for ordering
items[items.length - 1].shapes.push(...skirtShapes);
record(A.ring(BODY, GEO.skirt[1] - 0.01, GEO.skirt[1] + 0.01, 0, RI, { name: "body.deck", ...SKIN }));

// RP-1 tank: downcomer, ring frames, liquid, downcomer above the liquid
const RP1_WIN = GEO.windows.rp1;
const DOWNCOMER = G.disc(GEO.rp1[0] + 0.01, GEO.rp1[1] + 2, 2.2, BODY, P, {});
const rp1Inside = [
  S(DOWNCOMER, { tone: "mid", crease: "none", inner: Ln([70, 100, 130].map((z) => G.arcOf(BODY, z, 2.2, P)).join(""), { tone: "faint" }) }),
  // slosh baffle ring at mid height
  Ln(G.arcOf(BODY, 96, RI - 0.2, P, { inward: true, least: -1 }) + G.arcOf(BODY, 96, RI - 3.4, P, { inward: true, least: -1 }), { tone: "lo" }),
  `<g data-dyn="rp1">${parts.drawDesc(parts.liquid("tank.rp1", M.rp1Level(M.stateAt(M.T_END).rp1), RP1_WIN, "fb-rp1"), P)}</g>`,
  `<g data-dyn="rp1-tube">${parts.drawDesc(parts.tubeAbove(M.rp1Level(M.stateAt(M.T_END).rp1)), P)}</g>`,
].join("");
skinBand(GEO.rp1[0], GEO.rp1[1], "hi", { name: "body.rp1", seams: [60, 100, 140], window: windowOf(RP1_WIN[0], RP1_WIN[1], rp1Inside, { frames: [60, 80, 120, 140] }) });
record(A.disc(BODY, GEO.rp1[0] + 0.01, GEO.rp1[1] + 2, 2.2, { name: "tank.downcomer", owner: "body" }));
// domes between the tanks, recorded so the audit sees the tank floors
const domeUp = (z0, h) => Array.from({ length: 13 }, (_, i) => {
  const u = i / 12;
  return [z0 + h * u, RI * Math.sqrt(Math.max(0, 1 - u * u)), i && i < 12 ? 1 : 0];
});
skinBand(GEO.inter[0], GEO.inter[1], "hi", { name: "body.intertank", seams: [GEO.inter[0] + 0.5, GEO.inter[1] - 0.5, (GEO.inter[0] + GEO.inter[1]) / 2] });
record(A.solid(BODY, domeUp(GEO.inter[0], 13), { name: "tank.rp1-dome", owner: "body" }));

// LOX tank: COPVs on the far wall, baffles, liquid
const LOX_WIN = GEO.windows.lox;
const copvs = [];
const copvShapes = [];
for (const d of [-24, 0, 24]) {
  const c = on(AZ + 180 + d, RI - 2.45, 0);
  const CF = G.frameOf([c[0], c[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  copvs.push(S(G.sphereOf([c[0], c[1], 334], 2.4, P, { steps: 28 }), { tone: "mid" }));
  copvs.push(S(G.disc(334, 350, 2.4, CF, P), { tone: "mid", crease: "none", inner: Ln(G.arcOf(CF, 342, 2.4, P), { tone: "faint" }) }));
  copvs.push(S(G.sphereOf([c[0], c[1], 350], 2.4, P, { steps: 28 }), { tone: "mid" }));
  copvShapes.push(record(A.disc(CF, 331.6, 352.4, 2.4, { name: "tank.copv", owner: "body" })));
  // strap to the wall
  copvs.push(Ln(k.segment([c[0], c[1], 342], on(AZ + 180 + d, RI, 342), P), { tone: "lo" }));
}
const loxInside = [
  ...copvs,
  Ln([250, 300].flatMap((z) => [G.arcOf(BODY, z, RI - 0.2, P, { inward: true, least: -1 }), G.arcOf(BODY, z, RI - 3.4, P, { inward: true, least: -1 })]).join(""), { tone: "lo" }),
  `<g data-dyn="lox">${parts.drawDesc(parts.liquid("tank.lox", M.loxLevel(M.stateAt(M.T_END).lox), LOX_WIN, "fb-lox"), P)}</g>`,
].join("");
skinBand(GEO.lox[0], GEO.lox[1], "hi", { name: "body.lox", seams: [216, 256, 296, 336], window: windowOf(LOX_WIN[0], LOX_WIN[1], loxInside, { frames: [200, 224, 272, 320, 360] }) });
items[items.length - 1].shapes.push(...copvShapes);
record(A.solid(BODY, domeUp(GEO.lox[1], 13), { name: "tank.lox-fwd-dome", owner: "body" }));

// interstage: carbon composite, open at the top
const IS = GEO.istage;
{
  const id = "body.interstage";
  const paths = G.solidOf([[IS[0], BR], [IS[1], BR]], BODY, P, { steps: 64, smooth: false, rims: "all" });
  const svg =
    S(paths, { tone: "mid", inner: Ln([IS[0] + 0.5, 400, 420].map((s) => G.arcOf(BODY, s, BR, P)).join(""), { tone: "faint" }) }) +
    `<path class="fb-void" d="${G.circleOf(BODY, IS[1], RI, P)}"/>` +
    Ln(G.arcOf(BODY, IS[1], RI, P, { inward: true, least: -1 }), { tone: "lo" }) +
    Ln([IS[1] - 8, IS[1] - 16].map((s) => G.arcOf(BODY, s, RI, P, { inward: true, least: -1 })).join(""), { tone: "faint" }) +
    Dots(G.dotsOf(BODY, IS[1], BR - 0.9, 48, P, { all: true }), { size: 0.36, tone: "mid" });
  put([0, 0, (IS[0] + IS[1]) / 2], svg, { name: id, shapes: [record(A.ring(BODY, IS[0], IS[1], RI, BR, { name: id, ...SKIN }))] });
}

// ---------------------------------------------------------------- fittings on the skin
const RACE_DEG = AZ - 62;
boxOn(RACE_DEG, BR, 19.6, 5, 42, 54, { name: "body.aft-umbilical", owner: "body", extra: Dots([at(on(RACE_DEG, 19.6, 45)), at(on(RACE_DEG, 19.6, 51))], { size: 0.4 }) });
boxOn(RACE_DEG, BR, 19.6, 5, 358, 370, { name: "body.fwd-umbilical", owner: "body", extra: Dots([at(on(RACE_DEG, 19.6, 361)), at(on(RACE_DEG, 19.6, 367))], { size: 0.4 }) });
const CLAMPS = [90, 150, 210, 270, 330];
[54, ...CLAMPS.map((z) => z + 3)].forEach((z0, index) => boxOn(RACE_DEG, BR, 19.9, 1.6, z0, index < CLAMPS.length ? CLAMPS[index] : 358, { name: "body.raceway", owner: "body", tone: "mid" }));
for (const z of CLAMPS) boxOn(RACE_DEG, BR, 20.3, 2.2, z, z + 3, { name: "body.raceway-clamp", owner: "body", bias: 0.2 });
// cold-gas thruster pods at the top of the interstage
for (const deg of [AZ - 45, AZ + 45]) {
  const c = boxOn(deg, BR, 21.2, 3.2, 429, 436, { name: "body.cold-gas", owner: "body", bevel: 0.3 });
  const F = G.frameAlong(G.add3(G.mul3(dir(deg), 21.2), [0, 0, 432.5]), dir(deg));
  for (const dy of [-1.6, 0, 1.6]) {
    const NF = G.frameAlong(G.add3(F.o, G.mul3(tang(deg), dy)), dir(deg));
    put(NF.o, S(G.solidOf([[0, 0.45], [1.4, 0.75]], NF, P, { steps: 12 }), { tone: "mid" }), { name: nameFor("body.cold-gas-nozzle"), bias: 0.3, shapes: [record(A.solid(NF, [[0, 0.45], [1.4, 0.75]], { name: "body.cold-gas-nozzle", owner: "body" }))] });
  }
  void c;
}
// fin hinge brackets and actuators (static), fins themselves are dynamic
GEO.finAngles.forEach((deg, index) => {
  const side = Math.atan2(6.9, GEO.fin.hinge[0]) / DEG;
  for (const sign of [-1, 1]) boxOn(deg + sign * side, BR, 21.6, 0.8, 422.5, 426.5, { name: `fin${index}.bracket`, owner: `fin${index}`, bias: 0.1, tone: "mid" });
  boxOn(deg + Math.atan2(10.4, BR) / DEG, BR, 21.0, 1.3, 419.5, 427, { name: `fin${index}.actuator`, owner: `fin${index}`, tone: "mid", bevel: 0.3 });
});
function boxOnAt(deg, r0, r1, y0, y1, z0, z1, { tone = "mid", name, owner, bias = 0, bevel = 0 } = {}) {
  const F = G.frameOf([0, 0, 0], [0, 0, 1], dir(deg), tang(deg));
  const polygon = [[r0, y0], [r1, y0], [r1, y1], [r0, y1]];
  const id = nameFor(name ?? "box");
  const centre = G.add3(G.add3(G.mul3(dir(deg), (r0 + r1) / 2), G.mul3(tang(deg), (y0 + y1) / 2)), [0, 0, (z0 + z1) / 2]);
  put(centre, S(G.prismOf(F, polygon, z0, z1, P), { tone }), { bias, name: id, shapes: [record(A.prism(F, polygon, z0, z1, { name: id, owner }))] });
}
// leg hinge brackets on the skirt and strut pivots on the tank (static)
GEO.legAngles.forEach((deg, index) => {
  const owner = `leg${index}`;
  boxOnAt(deg, BR, 22.0, -3.6, 3.6, 31, 38, { name: `${owner}.bracket`, owner, tone: "mid" });
  const hinge = on(deg, GEO.leg.hinge[0], GEO.leg.hinge[1]);
  const HF = G.frameAlong(hinge, tang(deg));
  for (const [s0, s1] of [[-5.2, -3.7], [3.7, 5.2]]) put(G.pointOf(HF, (s0 + s1) / 2, 0, 0), S(G.disc(s0, s1, 1.1, HF, P), { tone: "mid" }), { name: nameFor(`${owner}.pin`), bias: 0.2, shapes: [record(A.disc(HF, s0, s1, 1.1, { name: `${owner}.pin`, owner }))] });
  boxOnAt(deg, BR, 20.6, -2.2, 2.2, 109.5, 114.5, { name: `${owner}.pivot`, owner, tone: "mid" });
  const ball = on(deg, GEO.leg.pivot[0], GEO.leg.pivot[1]);
  put(ball, S(G.sphereOf(ball, GEO.leg.ball, P, { steps: 28 }), { tone: "mid" }), { name: `${owner}.ball`, bias: 0.3, shapes: [record(A.ball(ball, GEO.leg.ball, { name: `${owner}.ball`, owner }))] });
});

// ---------------------------------------------------------------- dynamic parts at rest (landed)
const REST = M.stateAt(M.T_END);
GEO.legAngles.forEach((deg, index) => {
  const { strut, body, near } = parts.leg(index, REST.legs);
  const ref = on(deg, 50, 20);
  const order = near ? [...strut, ...body] : [...body, ...strut];
  putDescs(order, ref, { name: `leg${index}`, dyn: `leg${index}`, bias: near ? 0.5 : -0.5 });
});
GEO.finAngles.forEach((deg, index) => {
  const descs = parts.fin(index, REST.fins);
  putDescs(descs, on(deg, 26, 425), { name: `fin${index}`, dyn: `fin${index}`, bias: 0.3 });
});

// ---------------------------------------------------------------- settle and emit
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it"${item.dyn ? ` data-dyn="${item.dyn}"` : ""}${item.engine !== undefined ? ` data-engine="${item.engine}"` : ""} data-i="${index}">${item.svg}</g>`);

const LABEL_TEXT =
  "A Falcon 9 first-stage booster standing on its landing pad with three panels cut away: the engine skirt showing the Merlin turbopumps, the RP-1 tank with the oxygen downcomer through it, and the liquid-oxygen tank with its helium bottles. Nine Merlin engines sit below; four grid fins and four landing legs fold out as the mission clock runs.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "fb-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fb-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="fb-booster">${groups.join("")}</g></svg>`;
const lips = ENGINES.map(([x, y], index) => `<path class="fb-rim" data-engine="${index}" d="${G.arcOf(engineFrame([x, y]), 0, bell(0), P, { least: -0.05 })}"/>`).join("");
const glowSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fb-glow" viewBox="0 0 ${W} ${H}" aria-hidden="true">${lips}</svg>`;

const DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  exit: EXIT,
  bellR: bell(0),
  engines: ENGINES,
  pad: [PAD.w / 2, PAD.r],
  padZ: PAD_Z[1],
  phases: M.PHASES.map(({ id, name, from, to, say }) => ({ id, name, from, to, say })),
  tEnd: M.T_END,
  windows: GEO.windows,
};

const PHASE_BUTTONS = M.PHASES.filter((phase) => phase.id !== "landed")
  .map((phase, index) => `<button type="button" class="fb-phase" data-phase="${phase.id}" data-at="${phase.from}"><span class="fb-num">${String(index + 1).padStart(2, "0")}</span>${phase.name}</button>`)
  .join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Falcon 9 · first stage</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.clockText(M.T_END)} · landed</span></div>`;
const controls = `<div class="fb-controls"><button type="button" class="fb-play" data-play><span class="fb-lamp" aria-hidden="true"></span><span data-play-label>Play</span></button><span class="fb-hint">Drag across the figure to scrub the mission clock</span><span class="fb-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="fb-stage" tabindex="0" role="slider" aria-label="Falcon 9 first stage. Drag or use the arrow keys to move the mission clock from liftoff to touchdown; Space plays and pauses, Home and End jump to the ends." aria-valuemin="0" aria-valuemax="${M.T_END}" aria-valuenow="${M.T_END}" aria-valuetext="Touchdown, landed on four legs">${backSvg}<canvas class="fb-plume" aria-hidden="true"></canvas>${frontSvg}${glowSvg}</div>`;
const caption =
  "The Falcon 9 first stage is a 3.66 m aluminium-lithium tube 42 m tall: a liquid-oxygen tank above a kerosene tank, with the oxygen fed down a central pipe through the kerosene to nine Merlin 1D engines in an octagonal thrust structure. At liftoff all nine burn 287 t of oxygen and 124 t of RP-1 at 7,600 kN; after main-engine cut-off three engines turn the booster home, three more shield it through re-entry, titanium grid fins steer the fall, and the centre engine throttles down for a landing on four legs. The clock, altitude and speed follow a typical return-to-launch-site profile.";
const body = `<figure class="iso-figure fb"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="fb-phases">${PHASE_BUTTONS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

// inline the lathe module after the kit, renaming the three helpers both define
const latheScript = () =>
  readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8")
    .replace(/^import .*$/m, "")
    .replace(/^export /gm, "")
    .replace(/\b(oriented|signedArea|runsOf)\b/g, "lathe_$1");
const partsScript = () => readFileSync(join(HERE, "parts.mjs"), "utf8").replace(/^export /gm, "");
const modelScript = () => readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "booster.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Falcon 9 first stage", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + "\n" + latheScript() + "\n" + glScript() + "\n" + modelScript() + "\n" + partsScript() + "\n" + LIVE, width: 900 });
const name = THEME === "light" ? "falcon-booster-light.html" : "falcon-booster.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { cover: ["body.skirt", "body.rp1", "body.lox", "body.interstage"] });
