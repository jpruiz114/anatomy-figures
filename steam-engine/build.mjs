import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, partsOf } from "./parts.mjs";
const DEG = M.DEG;

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 980;
const H = 640;
const Z = GEO.axisZ;
const TOP = 12; // bed top
const BED = { x: -150, y: -34, w: 300, d: 68, r: 4 };
const AZ = GEO.azimuth;
const X_AXIS = [1, 0, 0];
const Y_AXIS = [0, 1, 0];
const UP = [0, 0, 1];
const alongX = (x, y, z) => G.frameOf([x, y, z], X_AXIS, [0, 1, 0], [0, 0, 1]);
const alongY = (x, y, z) => G.frameOf([x, y, z], Y_AXIS, [1, 0, 0], [0, 0, 1]);
const FLOOR = G.frameOf([0, 0, 0], UP, [1, 0, 0], [0, 1, 0]);

const FW = GEO.flywheel;
const P = k.fitProjection(
  [...k.boxCorners(BED, -6, TOP), [GEO.shaft.x, FW.y0, Z + FW.rimOut], [GEO.shaft.x, FW.y1, Z + FW.rimOut], [GEO.shaft.x - FW.rimOut, FW.y0, Z], [GEO.shaft.x + FW.rimOut, FW.y1, Z], [-120, 30, 70]],
  W,
  H,
  { pad: 26, azimuth: AZ, elevation: GEO.elevation },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const parts = partsOf(k, G, M);

const R = A.recorder(P);
const { items, nameFor } = R;
const record = R.solid;
function put(ref, svg, { bias = 0, shapes = [], name, dyn } = {}) {
  R.put({ at: ref, bias, svg, shapes, name: name ?? nameFor("item"), dyn });
}
function shapeOf(desc) {
  const meta = { name: desc.name, owner: desc.owner };
  if (desc.kind === "disc") return A.disc(desc.F, desc.s0, desc.s1, desc.r, meta);
  if (desc.kind === "ring") return A.ring(desc.F, desc.s0, desc.s1, desc.rIn, desc.rOut, meta);
  if (desc.kind === "prism" || desc.kind === "faces") return A.prism(desc.F, desc.polygon, desc.s0, desc.s1, meta);
  if (desc.kind === "ball") return A.ball(desc.at, desc.r, meta);
  return null;
}
function putDescs(descs, ref, { bias = 0, name, dyn }) {
  const svg = descs.map((desc) => parts.drawDesc(desc, P)).join("");
  put(ref, svg, { bias, name, dyn, shapes: descs.map(shapeOf).filter(Boolean).map(record) });
}
function boxAt(plan, z0, z1, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0.4, steps = 2, inner = "" } = {}) {
  const id = nameFor(name ?? "box");
  put([plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone, inner }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z0, z1 - z0, { name: id, owner }, steps))] });
}
function turned(F, profile, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, steps, smooth } = {}) {
  const id = nameFor(name ?? "turned");
  const auto = profile.some((p) => p[2]);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth ? { smooth } : auto ? {} : { smooth: false }), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.solid(F, profile, { name: id, owner, curve: auto && !smooth?.slope ? profile : undefined }))] });
}
function ringAt(F, s0, s1, rIn, rOut, { tone = "hi", name, owner, bias = 0, extra = "", bevel = 0, recordIn = rIn } = {}) {
  const id = nameFor(name ?? "ring");
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P, bevel ? { bevel } : {}), { tone }) + extra, { bias, name: id, shapes: [record(A.ring(F, s0, s1, recordIn, rOut, { name: id, owner }))] });
}
function discAt(F, s0, s1, r, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, crease } = {}) {
  const id = nameFor(name ?? "disc");
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, bevel ? { bevel } : {}), { tone, crease, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.disc(F, s0, s1, r, { name: id, owner }))] });
}

// ---------------------------------------------------------------- bed (static, in the sorted layer too)
const STAND = { owner: "stand.frame" };
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BED, -6, 6, P)}"/>`);
const FEET = [-130, 0, 130].flatMap((x) => [[x, -24], [x, 24]]).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of FEET) {
  back.push(S(k.slabOf({ x: x - 9, y: y - 6, w: 18, d: 12, r: 1.5 }, -6, 6, P, 3), { tone: "lo" }));
  record(A.slab({ x: x - 9, y: y - 6, w: 18, d: 12, r: 1.5 }, -6, 6, { name: "stand.foot" }, 3));
}
back.push(S(k.slabOf(BED, 0, TOP, P, 6, 1.4), { tone: "mid", inner: Ln(k.sideSeam(BED, 4, P, 6), { tone: "faint" }) }));
record(A.slab(BED, 0, TOP, { name: "stand.bed" }, 6));
back.push(Ln(k.planOutline(k.insetPlan(BED, 5), TOP, P, 6), { tone: "lo" }));
const BOLTS = [...k.corners(BED, 9), [-60, BED.y + 9], [-60, BED.y + BED.d - 9], [20, BED.y + 9], [20, BED.y + BED.d - 9]];
back.push(Ln(BOLTS.map(([x, y]) => k.ring(x, y, 2.4, TOP, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(BOLTS.map(([x, y]) => at([x, y, TOP])), { size: 0.55 }));
const STRIP = { x: -140, y: BED.y + BED.d - 10, w: 200, d: 5, r: 0.8 };
back.push(S(k.slabOf(STRIP, TOP, 0.6, P, 3), { tone: "lo" }));
const TICKS = k.topTicks(STRIP.x, STRIP.x + STRIP.w, 5, 5, STRIP.y + 0.15, TOP + 0.6, [2.4, STRIP.d - 0.3], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 2.5, TOP + 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 2.5, TOP + 0.6])], { size: 0.45 }));
const LABEL = { x: 92, y: BED.y + BED.d - 18, w: 44, d: 10, r: 1.2 };
back.push(S(k.slabOf(LABEL, TOP, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), TOP + 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 4, LABEL.y + 6.6], TOP + 1, P, "x"), "No. 7 · 8 × 16 in", { size: 3.4, tone: "lo" }));
back.push(Dots([at([LABEL.x + 2.4, LABEL.y + LABEL.d / 2, TOP + 1]), at([LABEL.x + LABEL.w - 2.4, LABEL.y + LABEL.d / 2, TOP + 1])], { size: 0.45 }));

// ---------------------------------------------------------------- cylinder
const CYL = { owner: "cylinder" };
const B = GEO.barrel;
const BF = alongX(0, 0, Z);
// saddle under the barrel
boxAt({ x: -130, y: -9, w: 36, d: 18, r: 1.5 }, TOP, Z - B.r, { name: "cylinder.saddle", ...CYL, inner: Ln(k.sideSeam({ x: -130, y: -9, w: 36, d: 18, r: 1.5 }, TOP + 3, P, 2), { tone: "faint" }) });

// barrel with its cutaway window
const WIN = GEO.window;
function barrelWindowPoints() {
  const corner = 3;
  const a0 = WIN.deg0 * DEG;
  const a1 = WIN.deg1 * DEG;
  const arc0 = B.r * a0;
  const arc1 = B.r * a1;
  const pts = [];
  const cornerPts = (cx, cz, start) => {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2);
      pts.push([cx + corner * Math.cos(a), cz + corner * Math.sin(a)]);
    }
  };
  cornerPts(WIN.x1 - corner, arc1 - corner, 0);
  cornerPts(WIN.x0 + corner, arc1 - corner, Math.PI / 2);
  cornerPts(WIN.x0 + corner, arc0 + corner, Math.PI);
  cornerPts(WIN.x1 - corner, arc0 + corner, 1.5 * Math.PI);
  return pts.map(([x, arc]) => [x, B.r * Math.cos(arc / B.r), Z + B.r * Math.sin(arc / B.r)]);
}
const REST = M.stateAt(GEO.rest);
let barrelShape = null;
const BANDS = [-134, -90];
{
  const outer = barrelWindowPoints();
  const path = k.pathOf(outer.map(at), true);
  const inside = parts.cylinderInside(GEO.rest);
  const bore = GEO.bore;
  const BOREF = alongX(0, 0, Z);
  const body = [
    `<path class="se-cavity" d="${path}"/>`,
    Ln([-126, -112, -98].map((x) => G.arcOf(BOREF, x, bore.r, P, { inward: true, least: -1 })).join(""), { tone: "lo" }),
    Ln(k.segment([bore.x0, -bore.r * 0.5, Z - bore.r * 0.86], [bore.x1, -bore.r * 0.5, Z - bore.r * 0.86], P) + k.segment([bore.x0, -bore.r * 0.95, Z - bore.r * 0.3], [bore.x1, -bore.r * 0.95, Z - bore.r * 0.3], P), { tone: "faint" }),
    `<g data-dyn="cylinder">${inside.descs.map((d) => parts.drawDesc(d, P)).join("")}</g>`,
  ].join("");
  const window = `<defs><clipPath id="se-win0"><path d="${path}"/></clipPath></defs><g clip-path="url(#se-win0)">${body}</g><path class="iso-line se-cut" data-tone="lo" d="${path}"/>`;
  const cuts = [B.x0, ...BANDS.flatMap((x) => [x - 0.8, x + 0.8]), B.x1];
  // what the window shows is recorded only as far as the window reaches
  // the rod's hidden stretch beyond the window segment is recorded with the segment that hides it
  const SPLIT = BANDS[1] - 0.8;
  const insideShapes = inside.descs.filter((d) => d.kind !== "steam").map((d) => shapeOf(d.name === "motion.rod-inside" ? { ...d, s1: SPLIT } : d)).map(record);
  const rodBeyond = inside.descs.filter((d) => d.name === "motion.rod-inside").map((d) => record(shapeOf({ ...d, s0: SPLIT })));
  for (let i = 0; i < cuts.length; i += 2) {
    const [x0, x1] = [cuts[i], cuts[i + 1]];
    const last = i === cuts.length - 2;
    const holdsWindow = x0 <= WIN.x0 && x1 >= WIN.x1;
    const paths = G.solidOf([[x0, B.r], [x1, B.r]], BF, P, { steps: 64, smooth: false });
    const name = `cylinder.barrel${i / 2}`;
    let own;
    if (holdsWindow) {
      // the skin with the window cut from it: full rings outside the window, a C-section through it
      const a0 = WIN.deg0 * DEG;
      const a1 = WIN.deg1 * DEG;
      const outer = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * j) / 48).map((a) => [B.r * Math.cos(a), B.r * Math.sin(a)]);
      const innerArc = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * (48 - j)) / 48).map((a) => [bore.r * Math.cos(a), bore.r * Math.sin(a)]);
      own = [
        record(A.ring(BF, x0, WIN.x0, bore.r, B.r, { name, ...CYL })),
        record(A.prism(BF, [...outer, ...innerArc], WIN.x0, WIN.x1, { name, ...CYL })),
        record(A.ring(BF, WIN.x1, x1, bore.r, B.r, { name, ...CYL })),
      ];
      barrelShape = own[0];
    } else own = [record(A.ring(BF, x0, x1, bore.r, B.r, { name, ...CYL }))];
    put([(x0 + x1) / 2, 0, Z], S(paths, { tone: "hi" }) + (last ? window : ""), { name, shapes: holdsWindow ? [...own, ...insideShapes] : last ? [...own, ...rodBeyond] : own });
  }
}
// lagging bands
for (const x of BANDS) ringAt(BF, x - 0.8, x + 0.8, B.r - 0.2, B.r + 0.6, { tone: "mid", name: "cylinder.band", ...CYL, recordIn: GEO.bore.r });
// covers
turned(BF, [[B.x0 - 4, 18], [B.x0, 18]], { name: "cylinder.head-cover", ...CYL, bevel: 0.6 });
turned(BF, [[B.x1, 18], [B.x1 + 4, 18]], { name: "cylinder.crank-cover", ...CYL, bevel: 0.6, extra: Dots(G.dotsOf(BF, B.x1 + 4, 17, 12, P, { all: true }), { size: 0.45, tone: "mid" }) });
ringAt(BF, B.x1 + 4, GEO.glandOuter - 3, GEO.rodR + 0.05, 4.6, { name: "cylinder.gland-boss", ...CYL, tone: "mid" });
ringAt(BF, GEO.glandOuter - 3 + 0.01, GEO.glandOuter, GEO.rodR + 0.05, 3.8, { name: "cylinder.gland-nut", ...CYL, tone: "mid" });
// relief valve on top and drain cocks underneath
{
  const RF = G.frameOf([-134, 0, Z + B.r], UP, [1, 0, 0], [0, 1, 0]);
  turned(RF, [[0, 2.6], [1.6, 2.6], [1.6, 1.6], [4.6, 1.6], [4.6, 2.2], [6.4, 2.2], [6.4, 1.2], [7.2, 1.2], [7.2, 0]], { name: "cylinder.relief-valve", ...CYL, tone: "mid" });
  for (const x of [-134, -90]) {
    const d = [0, -Math.sin(60 * DEG), -Math.cos(60 * DEG)];
    const DF = G.frameAlong([x, d[1] * B.r, Z + d[2] * B.r], d);
    turned(DF, [[0, 1.4], [2.6, 1.4], [2.6, 0.9], [5, 0.9], [5, 0]], { name: "cylinder.drain-cock", ...CYL, tone: "mid" });
  }
}

// port block and steam chest
const CH = GEO.chest;
boxAt({ x: -128, y: 15.6, w: 32, d: CH.y0 - 15.6, r: 0.8 }, 36, 48, { name: "cylinder.port-block", ...CYL, tone: "hi", bevel: 0 });
{
  const id = "cylinder.chest";
  const plan = { x: CH.x0, y: CH.y0, w: CH.x1 - CH.x0, d: CH.y1 - CH.y0, r: 1.2 };
  const CW = GEO.chestWindow;
  const face = CH.y1;
  const corner = 2;
  const pts = [];
  const cornerPts = (cx, cz, start) => {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2);
      pts.push([cx + corner * Math.cos(a), face, cz + corner * Math.sin(a)]);
    }
  };
  cornerPts(CW.x1 - corner, CW.z1 - corner, 0);
  cornerPts(CW.x0 + corner, CW.z1 - corner, Math.PI / 2);
  cornerPts(CW.x0 + corner, CW.z0 + corner, Math.PI);
  cornerPts(CW.x1 - corner, CW.z0 + corner, 1.5 * Math.PI);
  const path = k.pathOf(pts.map(at), true);
  const PT = GEO.ports;
  const slot = ([x0, x1]) => k.pathOf([at([x0, CH.y0 + 2.02, PT.z[0]]), at([x1, CH.y0 + 2.02, PT.z[0]]), at([x1, CH.y0 + 2.02, PT.z[1]]), at([x0, CH.y0 + 2.02, PT.z[1]])], true);
  const inside = parts.valve(GEO.rest);
  const body = [
    `<path class="se-cavity" d="${path}"/>`,
    `<path class="se-port" d="${slot(PT.head)}${slot(PT.exhaust)}${slot(PT.crank)}"/>`,
    Ln(slot(PT.head) + slot(PT.exhaust) + slot(PT.crank), { tone: "lo" }),
    `<g data-dyn="valve">${inside.map((d) => parts.drawDesc(d, P)).join("")}</g>`,
  ].join("");
  const window = `<defs><clipPath id="se-win1"><path d="${path}"/></clipPath></defs><g clip-path="url(#se-win1)">${body}</g><path class="iso-line se-cut" data-tone="lo" d="${path}"/>`;
  const boltsOnFace = [[-131, 35.5], [-93, 35.5], [-131, 48.5], [-93, 48.5], [-112, 35.2], [-112, 48.8]].map(([x, z]) => at([x, face, z]));
  put([(CH.x0 + CH.x1) / 2, (CH.y0 + CH.y1) / 2, (CH.z0 + CH.z1) / 2], S(k.slabOf(plan, CH.z0, CH.z1 - CH.z0, P, 2, 0.5), { tone: "hi", inner: Ln(k.sideSeam(plan, CH.z1 - 2.2, P, 2), { tone: "faint" }) }) + Dots(boltsOnFace, { size: 0.45, tone: "mid" }) + window, {
    name: id,
    shapes: [
      ...[
        [[CH.x0, CH.y0, CH.z0], [CH.x1, CH.y1, CH.z0 + 2]],
        [[CH.x0, CH.y0, CH.z1 - 2], [CH.x1, CH.y1, CH.z1]],
        [[CH.x0, CH.y0, CH.z0], [CH.x1, CH.y0 + 2, CH.z1]],
        [[CH.x0, CH.y1 - 2, CH.z0], [CH.x1, CH.y1, CH.z1]],
        [[CH.x0, CH.y0, CH.z0], [CH.x0 + 2, CH.y1, CH.z1]],
        [[CH.x1 - 2, CH.y0, CH.z0], [CH.x1, CH.y1, CH.z1]],
      ].map(([lo, hi]) => record(A.box(lo, hi, { name: id, ...CYL }))),
      ...inside.map(shapeOf).map(record),
    ],
  });
}
// valve-rod gland on the chest end
{
  const GF = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
  turned(GF, [[CH.x1, 3.2], [CH.x1 + 2.5, 3.2]], { name: "cylinder.valve-gland", ...CYL, tone: "mid" });
  turned(GF, [[CH.x1 + 2.5 - 0.01, 2.6], [CH.x1 + 3.2, 2.6]], { name: "cylinder.valve-gland-nut", ...CYL, tone: "mid" });
}

// steam inlet with a stop valve, exhaust pipe to the bed
const PIPES = [];
function pipe(points, r, { name, owner, flangeR = 1.6, bend = 3, tone = "mid", maxLength = 24, bias = 0.3, extraGaps = [] } = {}) {
  const line = G.fillet(points, Math.max(r * bend, 3), 12, { P, tube: r });
  const total = G.pathLength(line);
  const thick = Math.max(1, r * 0.55);
  const gaps = [[0, thick], [total - thick, total], ...extraGaps];
  const id = nameFor(name);
  R.route(id, line, r, { owner: id, gaps, rims: [r * flangeR, r * flangeR] });
  PIPES.push(id);
  for (const part of tubePieces(line, r, P, { maxLength, spacing: 1.2, gaps })) put(part.mid, tubeSvg(part, { tone }), { bias, name: `${id}:${part.from}`, shapes: [A.tube(part.points, part.radii)] });
  [[0, -1], [total, 1]].forEach(([along, sign]) => {
    const tangent = G.tangentAlong(line, along);
    const centre = G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2));
    const F = G.frameAlong(centre, tangent);
    const faces = Math.abs(G.dot3(F.a, V)) > 0.12 ? Dots(G.dotsOf(F, G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2, r * flangeR * 0.74, 6, P, { all: true }), { size: 0.4, tone: "mid" }) : "";
    put(centre, S(G.disc(-thick / 2, thick / 2, r * flangeR, F, P), { tone }) + faces, { bias, name: `${id}.flange`, shapes: [record(A.disc(F, -thick / 2, thick / 2, r * flangeR, { name: `${id}.flange`, owner: id }))] });
  });
  return line;
}
// inlet: up from the chest top, over the cylinder, down to a steam-main flange on the bed
const INLET_TOP = [-120, (CH.y0 + CH.y1) / 2, CH.z1];
const INLET_PTS = [INLET_TOP, [-120, INLET_TOP[1], 70], [-120, -28, 70], [-120, -28, TOP]];
const INLET_LINE = G.fillet(INLET_PTS, 9, 12, { P, tube: 3 });
const VALVE_AT = G.pathLength(INLET_LINE) * 0.5;
const INLET = pipe(INLET_PTS, 3, { name: "pipe.inlet", tone: "mid", extraGaps: [[VALVE_AT - 6, VALVE_AT + 6]] });
// stop valve on the horizontal run above the cylinder
{
  const along = VALVE_AT;
  const centre = G.pointAlong(INLET, along);
  const tangent = G.tangentAlong(INLET, along);
  const VF = G.frameAlong(centre, tangent);
  const r = 3;
  const bulge = Array.from({ length: 13 }, (_, i) => {
    const s = -4.5 + (9 * i) / 12;
    return [s, r + 1.8 * Math.sqrt(Math.max(0, 1 - (s / 4.5) ** 2)), i && i < 12 ? 1 : 0];
  });
  const body = [[-6, 0], [-6, r + 0.3], ...bulge, [6, r + 0.3], [6, 0]];
  put(centre, S(G.lathe(body, VF, P, { steps: 32 }), { tone: "mid" }), { bias: 0.4, name: "pipe.stop-valve", shapes: [record(A.body(VF, body, { name: "pipe.stop-valve", owner: "pipe.inlet" }))] });
  const SF = G.frameAlong(centre, UP);
  discAt(SF, r + 1.9, r + 7, 1.1, { tone: "mid", name: "pipe.valve-stem", owner: "pipe.inlet", crease: "none", bias: 0.5 });
  const wheel = G.add3(centre, [0, 0, r + 7.4]);
  const WF = G.frameAlong(wheel, UP);
  put(wheel, S(G.lathe([[-0.4, 3.6], [-0.4, 5], [0.4, 5], [0.4, 3.6]], WF, P, { steps: 32, hole: [0.4, 3.6] }), { tone: "mid" }) + Ln(G.spokesOf(WF, 0.4, 1.2, 3.6, 4, P), { tone: "mid" }) + S(G.disc(-0.6, 0.8, 1.2, WF, P), { tone: "mid" }), { bias: 0.6, name: "pipe.handwheel", shapes: [record(A.disc(WF, -0.4, 0.4, 5, { name: "pipe.handwheel", owner: "pipe.inlet" })), record(A.disc(WF, -0.6, 0.8, 1.2, { name: "pipe.handwheel-hub", owner: "pipe.inlet" }))] });
  // gap the pipe under the valve body: rebuild is costly, so the valve sits on a straight and hides the run under it
}
{
  // exhaust leaves the barrel on a saddle pad, then drops to a flange on the bed
  const PF = G.frameAlong([-104, 0, Z], [0, -1, 0]);
  const padR = 5.8;
  const padFace = B.r + 3;
  const low = Math.min(...Array.from({ length: 48 }, (_, i) => G.saddleStart(B.r, padR, (i / 48) * Math.PI * 2)));
  put([-104, -(B.r + 1.5), Z], S(G.saddleOf(PF, padR, B.r, padFace, P), { tone: "hi" }), { bias: 0.2, name: "cylinder.exhaust-pad", shapes: [record(A.disc(PF, low - 0.05, padFace, padR, { name: "cylinder.exhaust-pad", ...CYL, seated: true, cut: [barrelShape] }))] });
  pipe([[-104, -padFace, Z], [-104, -28, Z], [-104, -28, TOP]], 3.5, { name: "pipe.exhaust", tone: "mid" });
}

// ---------------------------------------------------------------- motion work (static parts)
const GUIDE = { owner: "guide" };
boxAt({ x: -56, y: -5, w: 8, d: 10, r: 0.8 }, TOP, 32, { name: "guide.pedestal", ...GUIDE });
boxAt({ x: -12, y: -5, w: 8, d: 10, r: 0.8 }, TOP, 32, { name: "guide.pedestal", ...GUIDE });
boxAt({ x: -60, y: -7, w: 60, d: 14, r: 0.8 }, 32, 36, { name: "guide.bar", ...GUIDE, tone: "hi", bevel: 0.5, extra: Ln(k.lineOnTop([-58, -6], [-2, -6], 36, P) + k.lineOnTop([-58, 6], [-2, 6], 36, P), { tone: "faint" }) + Dots([[-57, 0], [-3, 0]].map(([x, y]) => at([x, y, 36])), { size: 0.45 }) });

// crankshaft, pedestals, flywheel
const SX = GEO.shaft.x;
const SR = GEO.shaft.r;
const SHAFT = { owner: "shaft" };
const SHF = alongY(SX, 0, Z);
const PEDESTALS = [[-14, -6], [17, 25]];
for (const [y0, y1] of PEDESTALS) {
  boxAt({ x: SX - 9, y: y0, w: 18, d: y1 - y0, r: 1 }, TOP, Z, { name: "shaft.pedestal", ...SHAFT, extra: Ln(k.sideSeam({ x: SX - 9, y: y0, w: 18, d: y1 - y0, r: 1 }, Z - 8, P, 2), { tone: "faint" }) });
  boxAt({ x: SX - 9, y: y0, w: 18, d: y1 - y0, r: 1 }, Z - 0.01, Z + 8, { name: "shaft.cap", ...SHAFT, bevel: 0.6, extra: Dots([[SX - 6, (y0 + y1) / 2], [SX + 6, (y0 + y1) / 2]].map(([x, y]) => at([x, y, Z + 8])), { size: 0.5 }) });
  const OF = G.frameOf([SX, (y0 + y1) / 2, Z + 8], UP, [1, 0, 0], [0, 1, 0]);
  turned(OF, [[0, 1], [1.6, 1], [1.6, 1.5], [3.8, 1.5], [3.8, 0.9], [4.6, 0.9], [4.6, 0]], { name: "shaft.oil-cup", ...SHAFT, tone: "mid" });
}
const SEGMENTS = [[-64, FW.y0], [FW.y1, -14], [-6, GEO.crank.y0], [GEO.crank.y1, 17], [25, GEO.eccentric.y0], [GEO.eccentric.y1, 36]];
for (const [y0, y1] of SEGMENTS) discAt(SHF, y0 + 0.01, y1 - 0.01, SR, { tone: "mid", name: "shaft.segment", ...SHAFT, crease: "none" });
discAt(SHF, 36 - 0.01, 38.5, 6.5, { tone: "mid", name: "shaft.collar", ...SHAFT, bevel: 0.4 });
// outboard bearing on its own block beside the bed
boxAt({ x: SX - 11, y: -74, w: 22, d: 12, r: 1.2 }, -6, TOP, { name: "stand.outboard-base", tone: "lo" });
boxAt({ x: SX - 9, y: -72, w: 18, d: 8, r: 1 }, TOP - 0.01, Z, { name: "shaft.outboard", ...SHAFT, inner: Ln(k.sideSeam({ x: SX - 9, y: -72, w: 18, d: 8, r: 1 }, Z - 8, P, 2), { tone: "faint" }) });
boxAt({ x: SX - 9, y: -72, w: 18, d: 8, r: 1 }, Z - 0.01, Z + 8, { name: "shaft.outboard-cap", ...SHAFT, bevel: 0.6, extra: Dots([[SX - 6, -68], [SX + 6, -68]].map(([x, y]) => at([x, y, Z + 8])), { size: 0.5 }) });
discAt(SHF, -76, -72 + 0.01, 6.5, { tone: "mid", name: "shaft.collar", ...SHAFT, bevel: 0.4 });
// flywheel: inner wall seen through the rim, spokes behind the hub, hub, spokes in front, rim
{
  const nearHole = G.circleOf(SHF, FW.y1, FW.rimIn, P);
  const farHole = G.circleOf(SHF, FW.y0, FW.rimIn, P);
  const ref = [SX, (FW.y0 + FW.y1) / 2, Z];
  put(ref, `<path class="se-rim-inside" fill-rule="evenodd" d="${nearHole}${farHole}"/>` + Ln(G.arcOf(SHF, FW.y0 + 0.3, FW.rimIn, P, { inward: true, least: -1 }), { tone: "lo" }), { name: "flywheel.inner-wall", bias: -3, shapes: [record(A.ring(SHF, FW.y0, FW.y0 + 0.3, FW.rimIn - 0.3, FW.rimIn, { name: "flywheel.inner-wall", owner: "flywheel" }))] });
  const spokes = parts.spokes(GEO.rest, P);
  putDescs(spokes.far, ref, { name: "flywheel.spokes-far", dyn: "spokes-far", bias: -2 });
  discAt(SHF, FW.y0, FW.y1, FW.hub, { tone: "mid", name: "flywheel.hub", owner: "flywheel", bevel: 0.5, bias: -1, inner: G.arcOf(SHF, FW.y1 - 2, FW.hub, P) });
  putDescs(spokes.near, ref, { name: "flywheel.spokes-near", dyn: "spokes-near", bias: 0 });
  const band = G.lathe([[FW.y0, FW.rimOut], [FW.y1, FW.rimOut]], SHF, P, { steps: 96, fill: "facets", smooth: false, rims: "none" });
  const ring = (s, r) => Array.from({ length: 96 }, (_, i) => at(G.pointOf(SHF, s, r, (i / 96) * Math.PI * 2)));
  const hull = G.hullOf([...ring(FW.y0, FW.rimOut), ...ring(FW.y1, FW.rimOut)]);
  const outerNear = G.circleOf(SHF, FW.y1, FW.rimOut, P);
  const rimSvg =
    `<g class="iso-solid">` +
    band.shades.map((d, shade) => (d ? `<path class="iso-shade" data-shade="${shade}" d="${d}"/>` : "")).join("") +
    `<path class="iso-top" fill-rule="evenodd" d="${outerNear}${nearHole}"/>` +
    Ln(G.arcOf(SHF, (FW.y0 + FW.y1) / 2, FW.rimOut, P), { tone: "faint" }) +
    `<path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf(hull, true)}${nearHole}"/></g>` +
    Dots(G.dotsOf(SHF, FW.y1, FW.rimIn + 3.5, 12, P, { all: true }), { size: 0.42, tone: "mid" });
  put(ref, rimSvg, { name: "flywheel.rim", bias: 1, shapes: [record(A.ring(SHF, FW.y0, FW.y1, FW.rimIn, FW.rimOut, { name: "flywheel.rim", owner: "flywheel" }))] });
}
const ALLOW = [["flywheel.spokes-far", "flywheel.hub"], ["flywheel.spokes-near", "flywheel.hub"], ["flywheel.spokes-far", "flywheel.rim"], ["flywheel.spokes-near", "flywheel.rim"], ["flywheel.spokes-far", "flywheel.inner-wall"], ["flywheel.spokes-near", "flywheel.inner-wall"]];
const flywheelPair = (a, b) => /flywheel\.(spokes|hub|rim|inner-wall)/.test(a.name) && /flywheel\.(spokes|hub|rim|inner-wall)/.test(b.name);

// ---------------------------------------------------------------- dynamic parts at rest
{
  const ch = parts.crosshead(GEO.rest);
  putDescs(ch.descs, [ch.xc, 0, Z], { name: "motion.crosshead", dyn: "crosshead" });
  putDescs([{ kind: "disc", F: alongY(ch.xc, 0, Z), s0: GEO.conrodY[1], s1: GEO.pinY[1], r: 2.5, tone: "mid", name: "motion.pin-nose", owner: "motion", bevel: 0.3 }], [ch.xc, 14, Z], { name: "motion.pin-nose", dyn: "pin-nose", bias: 0.5 });
  const rod = parts.conrod(GEO.rest);
  putDescs(rod, [(ch.xc + parts.crankpin(GEO.rest)[0]) / 2, 11, Z], { name: "conrod", dyn: "conrod" });
  const crank = parts.crank(GEO.rest);
  putDescs(crank, [SX, 4, Z], { name: "crank", dyn: "crank" });
  const [xk, zk] = parts.crankpin(GEO.rest);
  putDescs([{ kind: "disc", F: alongY(xk, 0, zk), s0: GEO.crank.noseY[0], s1: GEO.crank.noseY[1], r: GEO.crank.pinR, tone: "hi", name: "crank.pin-nose", owner: "crank", bevel: 0.3 }], [xk, 14, zk], { name: "crank.pin-nose", dyn: "crank-nose", bias: 0.5 });
  const gear = parts.valveGear(GEO.rest);
  putDescs(gear.eccentric, [SX, 28, Z], { name: "gear.eccentric", dyn: "eccentric" });
  putDescs(gear.rod, [-70, GEO.valveRod.y, Z], { name: "gear.rod", dyn: "valve-rod" });
}

// ---------------------------------------------------------------- settle, emit
A.settle(R, P, { skip: (a, b) => A.sameRun(a, b) || flywheelPair(a, b) });
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it"${item.dyn ? ` data-dyn="${item.dyn}"` : ""} data-i="${index}">${item.svg}</g>`);

const LABEL_TEXT =
  "A horizontal single-cylinder mill engine on a cast bedplate, seen from above and to the side. The cylinder at the left has a panel cut from its barrel showing the piston and the steam on each side of it; the steam chest on its near side is cut open to show the slide valve over three ports. A piston rod runs through a gland to a crosshead on a guide bar, a connecting rod turns the crank, and the crankshaft carries a spoked flywheel at the far end and an eccentric at the near end whose rod works the valve.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g class="se-engine">${groups.join("")}</g>`] });

const DATA = { W, H, P, rest: GEO.rest, events: M.EVENTS, shownRpm: M.ENGINE.shownRpm, ratedRpm: M.ENGINE.ratedRpm };
const EVENT_BUTTONS = [
  ["admission", "Admission", M.EVENTS.head.admission + 2],
  ["cutoff", "Cut-off", M.EVENTS.head.cutoff + 1],
  ["release", "Release", M.EVENTS.head.release + 1],
  ["compression", "Compression", M.EVENTS.head.compression + 1],
]
  .map(([id, name, deg], index) => `<button type="button" class="se-event" data-event="${id}" data-at="${deg.toFixed(1)}"><span class="se-num">${String(index + 1).padStart(2, "0")}</span>${name}</button>`)
  .join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 2</span><span class="iso-plate-corner" data-corner="title">Mill engine · slide valve</span><span class="iso-plate-corner" data-corner="readout" data-readout>crank 60° · head end steam admitted · 7.0 bar</span></div>`;
const controls = `<div class="se-controls"><button type="button" class="se-play" data-play><span class="se-lamp" aria-hidden="true"></span><span data-play-label>Run</span></button><span class="se-hint">Drag across the engine to turn the crank by hand</span><span class="se-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="se-stage" tabindex="0" role="slider" aria-label="Mill engine. Drag or use the arrow keys to turn the crank; Space runs and stops the engine; Home returns to head-end dead centre." aria-valuemin="0" aria-valuemax="360" aria-valuenow="${GEO.rest}" aria-valuetext="Crank at 60 degrees, steam admitted to the head end at 7 bar">${svg}</div>`;
const caption = `A horizontal mill engine with a 200 mm bore and 400 mm stroke, double acting on 6 bar steam. The eccentric leads the crank by ${(90 + M.ENGINE.advanceDeg).toFixed(0)}°, so the slide valve opens each end about 6° before dead centre, cuts the steam off at ${Math.round((M.pistonAt(M.EVENTS.head.cutoff) / M.ENGINE.stroke) * 100)}% of the stroke and lets it expand, then releases it to exhaust at ${M.EVENTS.head.release.toFixed(0)}° and traps a cushion from ${M.EVENTS.head.compression.toFixed(0)}°. The same valve does both ends, half a turn apart. The pressure difference across the piston, times its speed, is the torque: ${Math.round(M.meanTorque)} N m on average, ${M.powerKw(M.ENGINE.ratedRpm).toFixed(0)} kW at its rated ${M.ENGINE.ratedRpm} rpm; the figure runs at ${M.ENGINE.shownRpm} rpm so the valve events can be followed.`;
const body = `<figure class="iso-figure se"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="se-events">${EVENT_BUTTONS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const latheScript = () =>
  readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8")
    .replace(/^import .*$/m, "")
    .replace(/^export /gm, "")
    .replace(/\b(oriented|signedArea|runsOf)\b/g, "lathe_$1");
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "engine.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Mill engine", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + "\n" + latheScript() + "\n" + strip("model.mjs") + "\n" + strip("parts.mjs") + "\n" + LIVE, width: 1040 });
const name = THEME === "light" ? "steam-engine-light.html" : "steam-engine.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);

A.auditOrExit(R, P, { cover: ["cylinder.barrel2", "cylinder.chest", "flywheel.inner-wall", "flywheel.rim"], allow: ALLOW });
