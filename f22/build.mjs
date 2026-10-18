import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { glCamera } from "../kit/gl.mjs";
import { kitScript, glScript } from "../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, RAD, partsOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 1120;
const H = 680;
const CZ = GEO.cz;
const UP = [0, 0, 1];
const X = [1, 0, 0];
const Y = [0, 1, 0];
const NY = GEO.nacelleY;
const NR = GEO.nacelleR;
const FLAT = NR * Math.cos(22.5 * RAD); // inradius of the nacelle octagon
const DK = GEO.deck;
const BM = GEO.boom;
const alongX = (x, y, z) => G.frameOf([x, y, z], X, [0, 1, 0], [0, 0, 1]);
const alongY = (x, y, z) => G.frameOf([x, y, z], Y, [1, 0, 0], [0, 0, 1]);
const vertical = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);
const FLOOR = { x: -120, y: -84, w: 250, d: 168, r: 10 };

const P = k.fitProjection([...k.boxCorners(FLOOR, -5, 0), [-95, 0, CZ], [100, 0, CZ], [84, -38, 72], [84, 38, 72], [25, 68, 48], [25, -68, 48], [100, 46, 39], [100, -46, 39]], W, H, { pad: 24, azimuth: GEO.azimuth, elevation: GEO.elevation });
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const parts = partsOf(k, G, M);
const REST = M.surfacesAt({ pitch: GEO.rest.pitch, roll: GEO.rest.roll }, GEO.rest.rudder, GEO.rest.throttle);

const R = A.recorder(P);
const { items, nameFor } = R;
const record = R.solid;
function put(ref, svg, { bias = 0, shapes = [], name, dyn } = {}) {
  R.put({ at: ref, bias, svg, shapes, name: name ?? nameFor("item"), dyn });
}
const shapeOf = (desc) => (desc.kind === "prism" ? A.prism(desc.F, desc.polygon, desc.s0, desc.s1, { name: desc.name, owner: desc.owner }) : desc.kind === "disc" ? A.disc(desc.F, desc.s0, desc.s1, desc.r, { name: desc.name, owner: desc.owner }) : null);
function putDescs(descs, ref, { bias = 0, name, dyn }) {
  put(ref, descs.map((d) => parts.drawDesc(d, P)).join(""), { bias, name, dyn, shapes: descs.map(shapeOf).filter(Boolean).map(record) });
}
function boxAt(plan, z0, z1, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0.4, steps = 2, inner = "" } = {}) {
  const id = nameFor(name ?? "box");
  put([plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone, inner }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z0, z1 - z0, { name: id, owner }, steps))] });
}
function prismAt(F, polygon, s0, s1, { tone = "hi", name, owner, bias = 0, extra = "", lines = "", className } = {}) {
  const id = nameFor(name ?? "prism");
  const cx = polygon.reduce((a, p) => a + p[0], 0) / polygon.length;
  const cy = polygon.reduce((a, p) => a + p[1], 0) / polygon.length;
  const centre = G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.add3(G.mul3(F.u, cx), G.mul3(F.v, cy)));
  put(centre, S(G.prismOf(F, polygon, s0, s1, P), { tone, className }) + lines + extra, { bias, name: id, shapes: [record(A.prism(F, polygon, s0, s1, { name: id, owner }))] });
}
function discAt(F, s0, s1, r, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, crease } = {}) {
  const id = nameFor(name ?? "disc");
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, bevel ? { bevel } : {}), { tone, crease, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.disc(F, s0, s1, r, { name: id, owner }))] });
}
function turned(F, profile, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, steps, smooth } = {}) {
  const id = nameFor(name ?? "turned");
  const auto = profile.some((p) => p[2]);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth ? { smooth } : auto ? {} : { smooth: false }), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.solid(F, profile, { name: id, owner, curve: auto && !smooth?.slope ? profile : undefined }))] });
}
const octagon = (r, rotDeg = 22.5) => Array.from({ length: 8 }, (_, i) => [r * Math.cos((rotDeg + i * 45) * RAD), r * Math.sin((rotDeg + i * 45) * RAD)]);
function cSection(rOut, rIn, deg0, deg1) {
  const a0 = deg0 * RAD;
  const a1 = deg1 * RAD;
  const outer = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * j) / 48).map((a) => [rOut * Math.cos(a), rOut * Math.sin(a)]);
  const inner = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * (48 - j)) / 48).map((a) => [rIn * Math.cos(a), rIn * Math.sin(a)]);
  return [...outer, ...inner];
}

// ---------------------------------------------------------------- hangar floor (back)
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(FLOOR, -5, 5, P)}"/>`);
back.push(S(k.slabOf(FLOOR, -5, 5, P, 8, 1.2), { tone: "lo" }));
record(A.slab(FLOOR, -5, 5, { name: "stand.floor" }, 8));
for (let x = -90; x <= 120; x += 30) back.push(Ln(k.lineOnTop([x, FLOOR.y + 6], [x, FLOOR.y + FLOOR.d - 6], 0, P), { tone: "faint" }));
for (let y = -60; y <= 60; y += 30) back.push(Ln(k.lineOnTop([FLOOR.x + 6, y], [FLOOR.x + FLOOR.w - 6, y], 0, P), { tone: "faint" }));
back.push(Ln(k.planOutline(k.insetPlan(FLOOR, 6), 0, P), { tone: "lo" }));
const TIES = k.corners(FLOOR, 14);
back.push(Ln(TIES.map(([x, y]) => k.ring(x, y, 3, 0, P, 20)).join(""), { tone: "lo" }));
back.push(Dots(TIES.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
const STRIP = { x: -105, y: FLOOR.y + FLOOR.d - 14, w: 220, d: 6, r: 0.8 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo" }));
const TICKS = k.topTicks(STRIP.x, STRIP.x + STRIP.w, 10, 5, STRIP.y + 0.15, 0.6, [2.6, STRIP.d - 0.3], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
const LABEL = { x: 76, y: FLOOR.y + 12, w: 40, d: 11, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 4, LABEL.y + 7.2], 1, P, "x"), "F-22A · 1 : 10", { size: 3.4, tone: "lo" }));
back.push(Dots([at([LABEL.x + 2.4, LABEL.y + LABEL.d / 2, 1]), at([LABEL.x + LABEL.w - 2.4, LABEL.y + LABEL.d / 2, 1])], { size: 0.45 }));

// ---------------------------------------------------------------- airframe
const AIR = { owner: "airframe" };
// radome: an ogive closed at the tip
{
  const RF = alongX(-95, 0, CZ);
  const r = (s) => 7.5 * Math.pow(Math.max(0, s) / 23, 0.6);
  const slope = (s) => (s <= 0.01 ? 50 : (7.5 * 0.6 * Math.pow(s / 23, -0.4)) / 23);
  const prof = [[0, 0], ...Array.from({ length: 14 }, (_, i) => [((i + 1) / 14) * 23, r(((i + 1) / 14) * 23), i < 13 ? 1 : 0])];
  turned(RF, prof, { name: "airframe.radome", ...AIR, tone: "mid", smooth: { slope, rows: 6 }, steps: 40 });
}
// forward fuselage: chined hexagon, flat top at deck height
const FWD = alongX(0, 0, CZ);
const CHINE = [[-7.5, -FLAT], [7.5, -FLAT], [11, 0], [7.5, FLAT], [-7.5, FLAT], [-11, 0]];
prismAt(FWD, CHINE, -72, -45, { name: "airframe.forward", ...AIR, tone: "hi", lines: Ln(k.segment([-70, -7.4, CZ + FLAT], [-47, -7.4, CZ + FLAT], P) + k.segment([-70, 7.4, CZ + FLAT], [-47, 7.4, CZ + FLAT], P), { tone: "faint" }) });
// canopy: half ellipse over the cockpit
{
  const ring = [[-6.5, FLAT]];
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    ring.push([-6.5 * Math.cos(a), FLAT + 8 * Math.sin(a)]);
  }
  ring.push([6.5, FLAT]);
  const frame = Ln(k.pathOf(ring.map(([y, v]) => at([-56, y * 1.002, CZ + v + 0.03])), false), { tone: "lo" });
  prismAt(FWD, ring, -66, -46, { name: "airframe.canopy", ...AIR, tone: "hi", className: "ff-glass", lines: frame });
}
// keel between the engines, intake boxes beside the cockpit, the flat upper deck
boxAt({ x: 62, y: -(NY - FLAT), w: 22, d: 2 * (NY - FLAT), r: 0.3 }, CZ - FLAT, DK.z0, { name: "airframe.keel", ...AIR, tone: "mid", bevel: 0 });
boxAt({ x: 84, y: -4, w: 16, d: 8, r: 0.6 }, 33, 39, { name: "airframe.sting", ...AIR, tone: "hi", bevel: 0.4 });
for (const side of [1, -1]) {
  const plan = { x: -45, y: side > 0 ? NY - FLAT : -(NY + FLAT), w: 25, d: 2 * FLAT, r: 0.6 };
  const seam = Ln(k.segment([-40, side * (NY + FLAT) + side * 0.01, CZ - FLAT], [-40, side * (NY + FLAT) + side * 0.01, DK.z0], P), { tone: "faint" });
  boxAt(plan, CZ - FLAT, DK.z0, { name: "airframe.intake", ...AIR, tone: "hi", bevel: 0.4, extra: seam });
}
{
  const plan = { x: -45, y: -DK.y, w: 129, d: 2 * DK.y, r: 0.8 };
  const seams = [-20, 20, 56].map((x) => k.lineOnTop([x, -DK.y], [x, DK.y], DK.z1, P)).join("") + k.lineOnTop([-45, 0], [84, 0], DK.z1, P);
  boxAt(plan, DK.z0, DK.z1, { name: "airframe.deck", ...AIR, tone: "hi", bevel: 0.4, extra: Ln(seams, { tone: "faint" }) + Dots([[-30, -12], [-30, 12], [40, -12], [40, 12]].map(([x, y]) => at([x, y, DK.z1])), { size: 0.42, tone: "mid" }) });
}
// nacelles: left full, right opened between the fan face and the afterburner
const OCT = octagon(NR);
const LF = alongX(0, -NY, CZ);
prismAt(LF, OCT, -20, GEO.nozzle.hinge, { name: "airframe.nacelle-left", ...AIR, tone: "hi" });
const RF2 = alongX(0, NY, CZ);
const BAY = [-8, 62];
prismAt(RF2, OCT, -20, BAY[0], { name: "airframe.nacelle-right-fore", ...AIR, tone: "hi" });
prismAt(RF2, OCT, BAY[1], GEO.nozzle.hinge, { name: "airframe.nacelle-right-aft", ...AIR, tone: "hi", lines: Ln(k.segment([64, NY + FLAT + 0.01, CZ - 3], [82, NY + FLAT + 0.01, CZ - 3], P), { tone: "faint" }) });
// the opened bay: the nacelle's lower and inner walls remain as octagon segments, the deck is its roof;
// the upper outer facets are off, and the wing root crosses the opening at mid height
{
  const V = (deg) => [NR * Math.cos(deg * RAD), NR * Math.sin(deg * RAD)];
  const I = (deg) => [(NR - 2 / Math.cos(22.5 * RAD)) * Math.cos(deg * RAD), (NR - 2 / Math.cos(22.5 * RAD)) * Math.sin(deg * RAD)];
  const top = FLAT - 2; // floor top, where the fan case rests
  const yAt = (z) => 4.21 + (5.95 * (z + FLAT)) / 5.95; // half width of the lower facets at height z (z from -FLAT)
  const half = yAt(-top);
  const wall = (polygon, name, cavity) => {
    const inner = cavity ? `<path class="ff-cavity" d="${k.pathOf([at([BAY[0], NY + cavity[0][0], CZ + cavity[0][1]]), at([BAY[1], NY + cavity[0][0], CZ + cavity[0][1]]), at([BAY[1], NY + cavity[1][0], CZ + cavity[1][1]]), at([BAY[0], NY + cavity[1][0], CZ + cavity[1][1]])], true)}"/>` : "";
    prismAt(RF2, polygon, BAY[0], BAY[1], { name, ...AIR, tone: "mid", extra: inner });
  };
  wall([V(-112.5), V(-67.5), [half, -top], [-half, -top]], "airframe.bay-floor");
  wall([[-half, -top], V(-157.5), I(-157.5), [-(half - 2 * Math.SQRT2), -top]], "airframe.bay-wall-low", [I(-157.5), [-(half - 2 * Math.SQRT2), -top]]);
  wall([V(-157.5), V(157.5), I(157.5), I(-157.5)], "airframe.bay-wall", [I(-157.5), I(157.5)]);
  wall([V(157.5), V(112.5), I(112.5), I(157.5)], "airframe.bay-wall-high", [I(157.5), I(112.5)]);
  wall([[half, -top], V(-22.5), I(-22.5), [half - 2 * Math.SQRT2, -top]], "airframe.bay-wall-outer");
}

// ---------------------------------------------------------------- the F119 inside the bay
const ENG = { owner: "engine" };
const EF = alongX(0, NY, CZ);
let clipCount = 0;
// a case with a window: the outer skin drawn as a cylinder, recorded as rings and a C-section, its inside drawn clipped
function casedWindow(x0, x1, win, inside, insideShapes, name, { extra = "" } = {}) {
  const pts = parts.windowPoints(NY, CZ, win.r, win.x0, win.x1, win.deg0, win.deg1, P);
  const path = k.pathOf(pts, true);
  const id = `ff-win${clipCount++}`;
  const arcs = Ln([win.x0 + 0.5, win.x1 - 0.5].map((x) => G.arcOf(EF, x, win.bore, P, { inward: true, least: -1 })).join(""), { tone: "lo" });
  const body = `<path class="ff-cavity" d="${path}"/>${arcs}${inside}`;
  const window = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g><path class="iso-line ff-cut" data-tone="lo" d="${path}"/>`;
  const skin = G.solidOf([[x0, win.r], [x1, win.r]], EF, P, { steps: 56, smooth: false });
  const shapes = [
    record(A.ring(EF, x0, win.x0, win.bore, win.r, { name, ...ENG })),
    record(A.prism(EF, cSection(win.r, win.bore, win.deg0, win.deg1), win.x0, win.x1, { name, ...ENG })),
    record(A.ring(EF, win.x1, x1, win.bore, win.r, { name, ...ENG })),
    ...insideShapes.map(record),
  ];
  put([(x0 + x1) / 2, NY, CZ], S(skin, { tone: "hi" }) + extra + window, { name, shapes });
  return pts;
}
const SHAFT_R = 1.5;
const shaftDesc = (s0, s1) => ({ kind: "disc", F: EF, s0, s1, r: SHAFT_R, tone: "mid", name: "engine.shaft", ...ENG });
const rotorDesc = (row) => ({ kind: "disc", F: EF, s0: row.x - row.width / 2, s1: row.x + row.width / 2, r: row.r, tone: "hi", name: `engine.rotor-${row.x}`, ...ENG });
const drawAll = (descs) => descs.map((d) => parts.drawDesc(d, P)).join("");
const [FAN_ROW, ...COMP_ROWS] = GEO.rotors;
{
  const win = GEO.windows.fan;
  const descs = [shaftDesc(-7, 4), rotorDesc(FAN_ROW)];
  const pts0 = parts.windowPoints(NY, CZ, win.r, win.x0, win.x1, win.deg0, win.deg1, P);
  const inside = drawAll(descs) + `<g data-dyn="fan">${parts.rotorBlades([FAN_ROW], 0, pts0, P)}</g>`;
  casedWindow(BAY[0], 4, win, inside, descs.map(shapeOf), "engine.fan-case", { extra: Dots(G.dotsOf(EF, 3.4, win.r - 0.5, 24, P, { fade: [0.04, 0.42] }), { size: 0.36, tone: "mid" }) });
}
{
  const win = GEO.windows.comp;
  const descs = [shaftDesc(4, 19.4), ...COMP_ROWS.map(rotorDesc)];
  const pts0 = parts.windowPoints(NY, CZ, win.r, win.x0, win.x1, win.deg0, win.deg1, P);
  const inside = drawAll(descs) + `<g data-dyn="comp">${parts.rotorBlades(COMP_ROWS, 0, pts0, P)}</g>`;
  casedWindow(4, 19.4, win, inside, descs.map(shapeOf), "engine.compressor-case");
}
// the flange between compressor and combustor, the combustor with its fuel manifold, turbine and afterburner duct
discAt(EF, 19.4, 20.6, 7.4, { tone: "mid", name: "engine.flange", ...ENG, extra: Dots(G.dotsOf(EF, 20, 7.4, 20, P, { fade: [0.04, 0.42] }), { size: 0.3, tone: "mid" }) });
turned(EF, [[20.6, 6.8], [24.6, 6.8], [24.6, 7.5], [26.2, 7.5], [26.2, 6.8], [28.6, 6.8], [28.6, 7.1], [29.6, 7.1], [29.6, 6.8], [31, 6.8], [31, 6.2]], { name: "engine.combustor", ...ENG, extra: Dots(G.dotsOf(EF, 25.4, 7.5, 12, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }) });
turned(EF, [[31, 6.2], [38, 6.5]], { name: "engine.turbine", ...ENG, inner: G.arcOf(EF, 34.5, 6.35, P, { slope: 0.3 / 7 }) });
turned(EF, [[38, 6.5], [38, 6.9], [41, 6.9], [41, 6.5], [62, 6.5]], { name: "engine.afterburner", ...ENG, inner: [48, 55].map((s) => G.arcOf(EF, s, 6.5, P)).join(""), extra: Dots(G.dotsOf(EF, 39.5, 6.9, 12, P, { fade: [0.04, 0.42] }), { size: 0.36, tone: "mid" }) });
// accessory gearbox under the duct and the mount up to the deck
boxAt({ x: 40, y: NY - 3, w: 10, d: 6, r: 0.6 }, CZ - FLAT + 2, CZ - 6.6, { name: "engine.gearbox", ...ENG, tone: "mid", bevel: 0.3, extra: Dots([at([42.5, NY + 3.01, CZ - 7.6]), at([47.5, NY + 3.01, CZ - 7.6])], { size: 0.4 }) });
boxAt({ x: 50, y: NY - 1.5, w: 6, d: 3, r: 0.3 }, CZ + 6.5, DK.z0, { name: "engine.mount", ...ENG, tone: "mid", bevel: 0 });

// ---------------------------------------------------------------- nozzles: side walls static, flaps dynamic
const NZ = GEO.nozzle;
for (const side of [1, -1]) {
  for (const w of [1, -1]) {
    const y = side * NY + w * (NZ.halfWidth + 0.7);
    boxAt({ x: NZ.hinge, y: y - 0.5, w: NZ.length, d: 1, r: 0.2 }, CZ - NZ.halfGap - 1, CZ + NZ.halfGap + 1, { name: "nozzle.wall", owner: "nozzle", tone: "mid", bevel: 0 });
  }
}
const sideOf = (descs, side) => descs.filter((d) => d.name.endsWith(side > 0 ? "right" : "left"));
for (const side of [1, -1]) putDescs(sideOf(parts.nozzleFlaps(REST), side), [NZ.hinge + 6, side * NY, CZ], { name: `nozzle.flaps-${side > 0 ? "right" : "left"}`, dyn: `nozzles-${side > 0 ? "right" : "left"}`, bias: 0.3 });

// ---------------------------------------------------------------- booms, wings, tails
for (const side of [1, -1]) {
  const plan = { x: BM.x0, y: side > 0 ? BM.y0 : -BM.y1, w: BM.x1 - BM.x0, d: BM.y1 - BM.y0, r: 0.4 };
  boxAt(plan, BM.z0, BM.z1, { name: "airframe.boom", ...AIR, tone: "hi", bevel: 0.4, inner: Ln(k.sideSeam(plan, BM.z0 + 3, P, 2), { tone: "faint" }) });
}
const WG = GEO.wing;
{
  const teDir = G.unit3([WG.te[0][0] - WG.te[1][0], WG.te[0][1] - WG.te[1][1], 0]);
  const fwd = G.cross3(teDir, UP);
  const inward = G.dot3(fwd, X) < 0 ? fwd : G.mul3(fwd, -1);
  for (const side of [1, -1]) {
    // the trailing edge shifts inward by the flap chord, then meets the root and tip lines again
    const shifted = (p, yLine) => {
      const q = [p[0] + inward[0] * WG.flapChord, p[1] + inward[1] * WG.flapChord];
      const t = (yLine - q[1]) / teDir[1];
      return [q[0] + teDir[0] * t, yLine];
    };
    const tip = shifted(WG.te[0], WG.te[0][1]);
    const root = shifted(WG.te[1], WG.te[1][1]);
    const ring = [[WG.le[0][0], side * WG.le[0][1]], [WG.le[1][0], side * WG.le[1][1]], [tip[0], side * tip[1]], [root[0], side * root[1]]];
    const id = `wing.${side > 0 ? "right" : "left"}`;
    const seam = k.onTop([[-10, side * WG.le[0][1]], [28, side * WG.le[1][1]]], WG.z + WG.thick, P);
    put([10, side * 44, WG.z], S(k.extrude(ring, WG.z, WG.thick, P, { bevel: 0.5 }), { tone: "hi" }) + Ln(seam, { tone: "faint" }) + Dots([[-8, 30], [12, 40], [27, 52]].map(([x, y]) => at([x, side * y, WG.z + WG.thick])), { size: 0.4, tone: "mid" }), { name: id, shapes: [record(A.extruded(ring, WG.z, WG.thick, { name: id, owner: "wing" }))] });
  }
}
for (const side of [1, -1]) {
  const tag = side > 0 ? "right" : "left";
  putDescs(sideOf(parts.wingFlaps(REST), side), [45, side * 46, WG.z], { name: `wing.flaps-${tag}`, dyn: `flaps-${tag}`, bias: 0.2 });
  putDescs(sideOf(parts.stabilators(REST), side), [GEO.stab.hingeX, side * 36, GEO.stab.z], { name: `stab.${tag}`, dyn: `stabs-${tag}`, bias: 0.2 });
}
for (const side of [1, -1]) {
  const Fn = GEO.fin;
  const fair = parts.finFairing(side);
  prismAt(alongX(0, 0, 0), fair.polygon, Fn.rootX, Fn.rootX + Fn.chordRoot, { name: `fin.fairing-${side > 0 ? "right" : "left"}`, owner: "fin", tone: "mid" });
  const fin = parts.finPolygon(side);
  const f = parts.finOf(side);
  // a panel seam from the root edge to the tip edge, on the face that looks at the camera
  const lift = G.mul3(f.n, (G.dot3(f.n, G.viewOf(P)) > 0 ? 1 : -1) * (Fn.thick / 2 + 0.01));
  const seam = Ln(k.segment(G.add3(G.add3(f.root, G.mul3(X, 9)), lift), G.add3(G.add3(G.add3(f.root, G.mul3(X, 18)), G.mul3(f.up, Fn.height)), lift), P), { tone: "faint" });
  prismAt(fin.F, fin.polygon, -Fn.thick / 2, Fn.thick / 2, { name: `fin.${side > 0 ? "right" : "left"}`, owner: "fin", tone: "hi", lines: seam });
}
for (const side of [1, -1]) putDescs(sideOf(parts.rudders(REST), side), [GEO.fin.rootX + 28, side * 30, GEO.fin.rootTop + 12], { name: `rudders-${side > 0 ? "right" : "left"}`, dyn: `rudders-${side > 0 ? "right" : "left"}`, bias: 0.2 });

// ---------------------------------------------------------------- landing gear
{
  const nx = -60;
  const nose = vertical(nx, 0);
  discAt(nose, 16.5, CZ - FLAT + 0.01, 1.8, { tone: "mid", name: "gear.nose-strut", owner: "gear", crease: "none" });
  boxAt({ x: nx - 2.5, y: -4, w: 5, d: 8, r: 0.4 }, 14.2, 16.5, { name: "gear.nose-fork", owner: "gear", tone: "mid", bevel: 0.3 });
  for (const side of [1, -1]) boxAt({ x: nx - 1.5, y: side > 0 ? 2.9 : -4, w: 3, d: 1.1, r: 0.2 }, 4, 14.2, { name: "gear.nose-leg", owner: "gear", tone: "mid", bevel: 0 });
  const NW = alongY(nx, 0, 7);
  discAt(NW, -2.8, 2.8, 7, { tone: "mid", name: "gear.nose-wheel", owner: "gear", bevel: 0.6, inner: G.circleOf(NW, 2.8, 4, P) + G.circleOf(NW, -2.8, 4, P) });
  for (const side of [1, -1]) discAt(NW, side > 0 ? 2.8 : -2.9, side > 0 ? 2.9 : -2.8, 2.2, { tone: "hi", name: "gear.nose-hub", owner: "gear" });
  for (const side of [1, -1]) {
    const y = side * 15;
    const strut = vertical(18, y);
    discAt(strut, 9, CZ - FLAT + 0.01, 2.2, { tone: "mid", name: "gear.main-strut", owner: "gear", crease: "none" });
    const MW = alongY(18, y, 9);
    discAt(MW, side > 0 ? 2.2 : -6.2, side > 0 ? 6.2 : -2.2, 9, { tone: "mid", name: "gear.main-wheel", owner: "gear", bevel: 0.8, inner: G.circleOf(MW, side > 0 ? 6.2 : -6.2, 5.5, P) });
    discAt(MW, side > 0 ? 6.2 : -7.4, side > 0 ? 7.4 : -6.2, 3, { tone: "hi", name: "gear.main-hub", owner: "gear", extra: Dots(G.dotsOf(MW, side > 0 ? 7.4 : -7.4, 2.1, 6, P, { all: true }), { size: 0.3, tone: "mid" }) });
    boxAt({ x: 5, y: y + (side > 0 ? 2.2 : -6.2), w: 4, d: 4, r: 0.3 }, 0, 3, { name: "stand.chock", owner: "stand.chock", tone: "lo", bevel: 0.3 });
  }
}

// ---------------------------------------------------------------- emit
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it"${item.dyn ? ` data-dyn="${item.dyn}"` : ""} data-i="${index}" data-name="${item.name}">${item.svg}</g>`);
const LABEL_TEXT =
  "An F-22 Raptor on its landing gear on a hangar floor, seen from the right rear quarter. The right engine bay has its side panels off, showing the F119: fan and compressor spools turning behind two cut windows, the combustor with its fuel manifold, the turbine and the afterburner duct, with the two-dimensional thrust-vectoring nozzle behind. The stabilators, canted fins with rudders, flaperons and ailerons move with the stick, and the nozzle flaps pitch with them. Afterburner plumes leave both nozzles.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g class="ff-jet">${groups.join("")}</g>`] });
const DATA = { W, H, P, camera: glCamera(P), rest: GEO.rest };
const THROTTLES = M.THROTTLE.map((id) => `<button type="button" class="ff-throttle" data-throttle="${id}"><span class="ff-lamp" aria-hidden="true"></span>${id === "military" ? "Mil" : id === "afterburner" ? "A/B" : "Idle"}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 5</span><span class="iso-plate-corner" data-corner="title">F-22A · controls and thrust</span><span class="iso-plate-corner" data-corner="readout" data-readout>stick · stabilators · nozzles</span></div>`;
const controls = `<div class="ff-controls">${THROTTLES}<span class="ff-hint">Drag: pitch and roll · A/D: rudder</span><span class="ff-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="ff-stage" tabindex="0" role="application" aria-label="F-22 controls. Drag to move the stick in pitch and roll; A and D move the rudder; 1, 2 and 3 set idle, military and afterburner.">${svg}<canvas class="ff-plume" aria-hidden="true"></canvas></div>`;
const caption = `The F-22A is ${M.F22.length} m long with a ${M.F22.span} m span and two Pratt and Whitney F119 engines of ${M.F22.thrustMilKn} kN each dry and ${M.F22.thrustAbKn} kN in afterburner, enough to cruise above Mach ${M.F22.supercruiseMach} without reheat. Air enters the caret inlets beside the cockpit and reaches each fan through a curved duct that hides the blades from radar; the fan and compressor squeeze it, fuel burns in the combustor, the turbines drive the two spools, and the afterburner duct can burn fuel again before the nozzle. Each nozzle is a pair of flaps that converge the jet and can swing it ${M.F22.nozzleVectorDeg} degrees up or down, so the exhaust steers the nose together with the all-moving stabilators (to ${M.F22.stabilatorDeg} degrees), the rudders on fins canted ${M.F22.finCantDeg} degrees, and the flaperons and ailerons; the flight computer blends every surface from one stick. Edges are aligned to a few directions and the fins lean so radar returns go somewhere else. The control gains here are illustrative, the limits are published.`;
const body = `<figure class="iso-figure ff"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="iso-caption">${caption}</span></figcaption></figure>`;
const latheScript = () => readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "").replace(/\b(oriented|signedArea|runsOf)\b/g, "lathe_$1");
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "f22.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "F-22 Raptor", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + "\n" + latheScript() + "\n" + glScript() + "\n" + strip("model.mjs") + "\n" + strip("parts.mjs") + "\n" + LIVE, width: 1180 });
const name = THEME === "light" ? "f22-light.html" : "f22.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);
A.auditOrExit(R, P, { cover: ["engine.fan-case", "engine.compressor-case", "airframe.canopy", "airframe.bay-wall"] });
