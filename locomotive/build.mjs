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
import { GEO, RAD, partsOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 1120;
const H = 660;
const AZ = GEO.azimuth;
const Z = GEO.axleZ;
const UP = [0, 0, 1];
const X_AXIS = [1, 0, 0];
const Y_AXIS = [0, 1, 0];
const alongX = (x, y, z) => G.frameOf([x, y, z], X_AXIS, [0, 1, 0], [0, 0, 1]);
const alongY = (x, y, z) => G.frameOf([x, y, z], Y_AXIS, [1, 0, 0], [0, 0, 1]);
const vertical = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);
const dir = (deg) => [Math.cos(deg * RAD), Math.sin(deg * RAD), 0];
const B = GEO.boiler;
const BZ = 126; // boiler axis height
B.z = BZ;
const CY = GEO.cyl;
const BALLAST = { x: -400, y: -135, w: 800, d: 270, r: 12 };

const P = k.fitProjection([...k.boxCorners(BALLAST, -42, 0), [-226, 0, 262], [-226, -16, 262], [260, -76, 210], [260, 76, 210], [310, 82, 92], [-300, -82, 92]], W, H, { pad: 24, azimuth: AZ, elevation: GEO.elevation });
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const parts = partsOf(k, G, M);
const REST = GEO.rest;

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
  return null;
}
function putDescs(descs, ref, { bias = 0, name, dyn }) {
  put(ref, descs.map((d) => parts.drawDesc(d, P)).join(""), { bias, name, dyn, shapes: descs.map(shapeOf).filter(Boolean).map(record) });
}
function boxAt(plan, z0, z1, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0.4, steps = 2, inner = "", stand = false } = {}) {
  const id = nameFor(name ?? "box");
  const svg = S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone, inner }) + extra;
  const shape = A.slab(plan, z0, z1 - z0, { name: id, owner }, steps);
  if (stand) {
    back.push(svg);
    record(shape);
  } else put([plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], svg, { bias, name: id, shapes: [record(shape)] });
}
function discAt(F, s0, s1, r, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, crease } = {}) {
  const id = nameFor(name ?? "disc");
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, bevel ? { bevel } : {}), { tone, crease, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.disc(F, s0, s1, r, { name: id, owner }))] });
}
function ringAt(F, s0, s1, rIn, rOut, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0, recordIn = rIn } = {}) {
  const id = nameFor(name ?? "ring");
  put(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P, bevel ? { bevel } : {}), { tone }) + extra, { bias, name: id, shapes: [record(A.ring(F, s0, s1, recordIn, rOut, { name: id, owner }))] });
}
function turned(F, profile, { tone = "hi", name, owner, bias = 0, extra = "", inner = "", bevel = 0, steps, smooth } = {}) {
  const id = nameFor(name ?? "turned");
  const auto = profile.some((p) => p[2]);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth ? { smooth } : auto ? {} : { smooth: false }), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  put(G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, name: id, shapes: [record(A.solid(F, profile, { name: id, owner, curve: auto && !smooth?.slope ? profile : undefined }))] });
}

// ---------------------------------------------------------------- track (back layer)
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BALLAST, -42, 15, P)}"/>`);
back.push(S(k.slabOf(BALLAST, -42, 15, P, 8, 1.2), { tone: "lo" }));
record(A.slab(BALLAST, -42, 15, { name: "stand.ballast" }, 8));
for (let i = 0; i < 13; i++) {
  const x = -360 + i * 60;
  boxAt({ x: x - 13, y: -125, w: 26, d: 250, r: 1 }, -27, -15, { name: "stand.sleeper", tone: "lo", bevel: 0, stand: true });
}
for (const y of [-71.75, 71.75]) {
  boxAt({ x: -390, y: y - 6.5, w: 780, d: 13, r: 0.5 }, -15, -12.5, { name: "stand.rail-foot", tone: "mid", bevel: 0, stand: true });
  boxAt({ x: -390, y: y - 2, w: 780, d: 4, r: 0.3 }, -12.5, -3, { name: "stand.rail-web", tone: "mid", bevel: 0, stand: true });
  boxAt({ x: -390, y: y - 3.5, w: 780, d: 7, r: 0.6 }, -3, 0, { name: "stand.rail-head", tone: "hi", bevel: 0.4, stand: true });
}

// ---------------------------------------------------------------- frames and running gear
const FR = { owner: "frame" };
const FRAME_TOP = 92;
for (const [y0, y1] of [[-56, -52], [52, 56]]) boxAt({ x: -290, y: y0, w: 590, d: y1 - y0, r: 0.8 }, 20, FRAME_TOP, { name: "frame.plate", ...FR, tone: "mid", inner: Ln(k.sideSeam({ x: -290, y: y0, w: 590, d: y1 - y0, r: 0.8 }, 56, P, 2), { tone: "faint" }) });
for (const x of [-255, -20]) boxAt({ x: x - 5, y: -52, w: 10, d: 104, r: 0.5 }, 24, 72, { name: "frame.stretcher", ...FR, tone: "mid", bevel: 0 });
for (const x of [135, 215]) boxAt({ x, y: -52, w: 10, d: 104, r: 0.5 }, 20, 30, { name: "frame.stretcher", ...FR, tone: "mid", bevel: 0 });
for (const [y0, y1] of [[-72, -56], [56, 72]]) boxAt({ x: -285, y: y0, w: 510, d: y1 - y0, r: 0.6 }, FRAME_TOP, FRAME_TOP + 4, { name: "frame.running-plate", ...FR, tone: "mid", bevel: 0.5 });
for (const x of [-300, 300]) {
  boxAt({ x, y: -82, w: 10, d: 164, r: 1 }, 40, FRAME_TOP, { name: "frame.buffer-beam", ...FR, tone: "hi", bevel: 0.6, extra: Dots([-70, -30, 30, 70].map((y) => at([x + (x < 0 ? 0 : 10), y, 84])), { size: 0.5 }) });
  const sign = x < 0 ? -1 : 1;
  for (const y of [-50, 50]) {
    const F = alongX(x + (sign < 0 ? 0 : 10), y, 52);
    discAt(F, 0, sign * 18, 6, { tone: "mid", name: "frame.buffer-shank", ...FR, crease: "none" });
    discAt(F, sign * 18, sign * 23, 12, { tone: "hi", name: "frame.buffer-head", ...FR, bevel: 0.5 });
  }
  boxAt({ x: x + (sign < 0 ? -12 : 10), y: -3, w: 12, d: 6, r: 0.5 }, 46, 58, { name: "frame.coupling-hook", ...FR, tone: "mid", bevel: 0 });
}
// axles, axleboxes, springs, wheels
const WH = GEO.wheel;
const ALLOW = [];
const skipPair = (a, b) => A.sameRun(a, b) || (/wheel\d\.(spokes|hub|tyre|inner-wall)/.test(a.name) && /wheel\d\.(spokes|hub|tyre|inner-wall)/.test(b.name) && a.name.slice(0, 6) === b.name.slice(0, 6));
GEO.axles.forEach((xa, index) => {
  discAt(alongY(xa, 0, Z), -52, 52, 7, { tone: "mid", name: "axle.shaft", owner: "axle", crease: "none" });
  for (const [y0, y1] of [[-64, -56], [56, 64]]) {
    boxAt({ x: xa - 11, y: y0, w: 22, d: y1 - y0, r: 1 }, 32, 58, { name: "axle.box", owner: "axle", tone: "mid", bevel: 0.5, extra: y0 > 0 ? Dots([at([xa - 6, 64, 54]), at([xa + 6, 64, 54]), at([xa - 6, 64, 36]), at([xa + 6, 64, 36])], { size: 0.45 }) : "" });
    // leaf spring on the frame top above the box
    for (let leaf = 0; leaf < 3; leaf++) boxAt({ x: xa - 30 + leaf * 4, y: y0 > 0 ? 58 : -64, w: 60 - leaf * 8, d: 6, r: 1 }, FRAME_TOP + 4 + leaf * 2.2, FRAME_TOP + 6.2 + leaf * 2.2, { name: "frame.spring-leaf", ...FR, tone: "mid", bevel: 0 });
  }
  // far wheel: a plain disc behind the frame
  discAt(alongY(xa, 0, Z), -80, -66, WH.r, { tone: "mid", name: `wheel${index}.far`, owner: "wheel", bevel: 0.6 });
  // near wheel: inner wall, spokes behind, hub, spokes in front, tyre
  const F = alongY(xa, 0, Z);
  const nearHole = G.circleOf(F, WH.y1, WH.tyreIn, P);
  const farHole = G.circleOf(F, WH.y0, WH.tyreIn, P);
  const ref = [xa, (WH.y0 + WH.y1) / 2, Z];
  const id = `wheel${index}`;
  put(ref, `<path class="lc-cavity" fill-rule="evenodd" d="${nearHole}${farHole}"/>` + Ln(G.arcOf(F, WH.y0 + 0.3, WH.tyreIn, P, { inward: true, least: -1 }), { tone: "lo" }), { name: `${id}.inner-wall`, bias: -3, shapes: [record(A.ring(F, WH.y0, WH.y0 + 0.3, WH.tyreIn - 0.3, WH.tyreIn, { name: `${id}.inner-wall`, owner: "wheel" }))] });
  const sp = parts.spokes(xa, REST, P);
  putDescs(sp.far, ref, { name: `${id}.spokes-far`, dyn: `${id}-spokes-far`, bias: -2 });
  discAt(F, WH.hubY0, WH.y1, WH.hub, { tone: "mid", name: `${id}.hub`, owner: "wheel", bevel: 0.5, bias: -1, inner: G.arcOf(F, WH.y1 - 2, WH.hub, P) });
  putDescs(sp.near, ref, { name: `${id}.spokes-near`, dyn: `${id}-spokes-near`, bias: 0 });
  const band = G.lathe([[WH.y0, WH.r], [WH.y1, WH.r]], F, P, { steps: 96, fill: "facets", smooth: false, rims: "none" });
  const ring = (s, r) => Array.from({ length: 96 }, (_, i) => at(G.pointOf(F, s, r, (i / 96) * Math.PI * 2)));
  const hull = G.hullOf([...ring(WH.y0, WH.r), ...ring(WH.y1, WH.r)]);
  const outerNear = G.circleOf(F, WH.y1, WH.r, P);
  const tyreSvg = `<g class="iso-solid">` + band.shades.map((d, shade) => (d ? `<path class="iso-shade" data-shade="${shade}" d="${d}"/>` : "")).join("") + `<path class="iso-top" fill-rule="evenodd" d="${outerNear}${nearHole}"/>` + Ln(G.circleOf(F, WH.y1, WH.tyreIn + 2.5, P), { tone: "faint" }) + `<path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf(hull, true)}${nearHole}"/></g>`;
  put(ref, tyreSvg, { name: `${id}.tyre`, bias: 1, shapes: [record(A.ring(F, WH.y0, WH.y1, WH.tyreIn, WH.r, { name: `${id}.tyre`, owner: "wheel" }))] });
  for (const pair of [["spokes-far", "hub"], ["spokes-near", "hub"], ["spokes-far", "tyre"], ["spokes-near", "tyre"], ["spokes-far", "inner-wall"], ["spokes-near", "inner-wall"]]) ALLOW.push([`${id}.${pair[0]}`, `${id}.${pair[1]}`]);
});

// ---------------------------------------------------------------- cylinder, chest, motion brackets
const CYF = alongX(0, CY.y, CY.z);
let cylWindow = "";
let clipCount = 0;
function windowOnCylinder(cx, cy, cz, r, x0, x1, deg0, deg1) {
  // a rounded rectangle on a cylinder along x; angles from +y toward +z
  const corner = 3;
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
  const outer = pts.map(([x, arc]) => [x, cy + r * Math.cos(arc / r), cz + r * Math.sin(arc / r)]);
  return k.pathOf(outer.map(at), true);
}
function cSection(rOut, rIn, deg0, deg1) {
  const a0 = deg0 * RAD;
  const a1 = deg1 * RAD;
  const outer = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * j) / 48).map((a) => [rOut * Math.cos(a), rOut * Math.sin(a)]);
  const inner = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * (48 - j)) / 48).map((a) => [rIn * Math.cos(a), rIn * Math.sin(a)]);
  return [...outer, ...inner];
}
{
  const WIN = GEO.windows.cyl;
  const path = windowOnCylinder(0, CY.y, CY.z, CY.r, WIN.x0, WIN.x1, WIN.deg0, WIN.deg1);
  const inside = parts.cylinderInside(REST);
  const id = `lc-win${clipCount++}`;
  const body = [`<path class="lc-cavity" d="${path}"/>`, Ln([-250, -230].map((x) => G.arcOf(CYF, x, CY.bore, P, { inward: true, least: -1 })).join(""), { tone: "lo" }), `<g data-dyn="cylinder">${inside.map((d) => parts.drawDesc(d, P)).join("")}</g>`].join("");
  cylWindow = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g><path class="iso-line lc-cut" data-tone="lo" d="${path}"/>`;
  const paths = G.solidOf([[CY.x0, CY.r], [CY.x1, CY.r]], CYF, P, { steps: 56, smooth: false });
  const shapes = [
    record(A.ring(CYF, CY.x0, WIN.x0, CY.bore, CY.r, { name: "cyl.barrel", owner: "cyl" })),
    record(A.prism(CYF, cSection(CY.r, CY.bore, WIN.deg0, WIN.deg1), WIN.x0, WIN.x1, { name: "cyl.barrel", owner: "cyl" })),
    record(A.ring(CYF, WIN.x1, CY.x1, CY.bore, CY.r, { name: "cyl.barrel", owner: "cyl" })),
    ...inside.filter((d) => d.kind !== "steam").map(shapeOf).map(record),
  ];
  put([(CY.x0 + CY.x1) / 2, CY.y, CY.z], S(paths, { tone: "hi" }) + cylWindow, { name: "cyl.barrel", shapes });
}
turned(CYF, [[CY.x0 - 4, 18], [CY.x0, 18]], { name: "cyl.front-cover", owner: "cyl", bevel: 0.6, extra: Dots(G.dotsOf(CYF, CY.x0 - 4, 17, 10, P, { all: true }), { size: 0.42, tone: "mid" }) });
ringAt(CYF, CY.x1, CY.coverOut, CY.rodR + 0.05, 18, { name: "cyl.rear-cover", owner: "cyl", tone: "hi", bevel: 0.6, extra: Dots(G.dotsOf(CYF, CY.coverOut, 17, 10, P, { all: true }), { size: 0.42, tone: "mid" }) });
ringAt(CYF, CY.coverOut, CY.glandOut - 2, CY.rodR + 0.05, 5, { name: "cyl.gland", owner: "cyl" });
ringAt(CYF, CY.glandOut - 2 + 0.01, CY.glandOut, CY.rodR + 0.05, 4, { name: "cyl.gland-nut", owner: "cyl" });
// cylinder bracket to the frame
boxAt({ x: CY.x0 + 2, y: 56, w: CY.x1 - CY.x0 - 4, d: CY.y - CY.r - 56 + 0.01, r: 0.8 }, 30, 60, { name: "cyl.bracket", owner: "cyl", tone: "mid", bevel: 0 });
// steam chest with its window
const CH = GEO.chest;
{
  const plan = { x: CH.x0, y: CH.y0, w: CH.x1 - CH.x0, d: CH.y1 - CH.y0, r: 1.2 };
  const CW = GEO.windows.chest;
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
  const py = GEO.valve.y0 + 0.02;
  const slot = ([x0, x1]) => k.pathOf([at([x0, py, PT.z[0]]), at([x1, py, PT.z[0]]), at([x1, py, PT.z[1]]), at([x0, py, PT.z[1]])], true);
  const inside = parts.valve(REST);
  const id = `lc-win${clipCount++}`;
  const body = [`<path class="lc-cavity" d="${path}"/>`, `<path class="lc-port" d="${slot(PT.head)}${slot(PT.exhaust)}${slot(PT.crank)}"/>`, Ln(slot(PT.head) + slot(PT.exhaust) + slot(PT.crank), { tone: "lo" }), `<g data-dyn="valve">${inside.map((d) => parts.drawDesc(d, P)).join("")}</g>`].join("");
  const window = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g><path class="iso-line lc-cut" data-tone="lo" d="${path}"/>`;
  const bolts = [[CH.x0 + 2, CW.z0 - 1], [CH.x1 - 2, CW.z0 - 1], [CH.x0 + 2, CW.z1 + 1], [CH.x1 - 2, CW.z1 + 1]].map(([x, z]) => at([x, face, z]));
  const walls = [
    [[CH.x0, CH.y0, CH.z0], [CH.x1, CH.y1, CH.z0 + 1.5]],
    [[CH.x0, CH.y0, CH.z1 - 1.5], [CH.x1, CH.y1, CH.z1]],
    [[CH.x0, CH.y0, CH.z0], [CH.x1, CH.y0 + 1.9, CH.z1]],
    [[CH.x0, CH.y1 - 1.5, CH.z0], [CH.x1, CH.y1, CH.z1]],
    [[CH.x0, CH.y0, CH.z0], [CH.x0 + 2, CH.y1, CH.z1]],
    [[CH.x1 - 2, CH.y0, CH.z0], [CH.x1, CH.y1, CH.z1]],
  ].map(([lo, hi]) => record(A.box(lo, hi, { name: "cyl.chest", owner: "cyl" })));
  put([(CH.x0 + CH.x1) / 2, (CH.y0 + CH.y1) / 2, (CH.z0 + CH.z1) / 2], S(k.slabOf(plan, CH.z0, CH.z1 - CH.z0, P, 2, 0.5), { tone: "hi", inner: Ln(k.sideSeam(plan, CH.z1 - 2, P, 2), { tone: "faint" }) }) + Dots(bolts, { size: 0.45, tone: "mid" }) + window, { name: "cyl.chest", shapes: [...walls, ...inside.map(shapeOf).map(record)] });
}
{
  const GF = alongX(0, GEO.valveRod.y, GEO.valveRod.z);
  ringAt(GF, CH.x1, CH.x1 + 3, GEO.valveRod.r + 0.05, 3.6, { name: "cyl.valve-gland", owner: "cyl" });
  ringAt(GF, CH.x1 + 3 + 0.01, GEO.valveRod.nut, GEO.valveRod.r + 0.05, 2.8, { name: "cyl.valve-gland-nut", owner: "cyl" });
}
// slide bar and motion brackets
const HC = GEO.crosshead;
boxAt({ x: -168, y: 56, w: 8, d: HC.y1 + 2 - 56, r: 0.6 }, 60, FRAME_TOP, { name: "motion.bracket", ...FR, tone: "mid", bevel: 0.3 });
boxAt({ x: -100, y: 56, w: 8, d: HC.y1 + 2 - 56, r: 0.6 }, 60, FRAME_TOP, { name: "motion.bracket", ...FR, tone: "mid", bevel: 0.3 });
boxAt({ x: -160, y: HC.y0 + 6, w: 60, d: HC.y1 + 2 - HC.y0 - 6, r: 0.6 }, HC.z1, 60, { name: "motion.slide-bar", ...FR, tone: "hi", bevel: 0.4, extra: Ln(k.lineOnTop([-160, HC.y1 - 1], [-100, HC.y1 - 1], 60, P), { tone: "faint" }) + Dots([at([-157, HC.y0 + 12, 60]), at([-103, HC.y0 + 12, 60])], { size: 0.45 }) });

// ---------------------------------------------------------------- boiler, smokebox, firebox, cab
const BF = alongX(0, 0, BZ);
const BOIL = { owner: "boiler" };
let INSIDE_TUBES = [];
const tubeShapes = [];
{
  const WIN = GEO.windows.boiler;
  const path = windowOnCylinder(0, 0, BZ, B.r, WIN.x0, WIN.x1, WIN.deg0, WIN.deg1);
  const id = `lc-win${clipCount++}`;
  const inside = [];
  // far inner wall, ring seams and stays
  inside.push(`<path class="lc-cavity" d="${path}"/>`);
  inside.push(Ln([-120, -50, 20].map((x) => G.arcOf(BF, x, B.bore, P, { inward: true, least: -1 })).join(""), { tone: "lo" }));
  // fire tubes on the near side of the water space, rows of three
  const tubes = [];
  for (const z of [BZ - 30, BZ - 16, BZ - 2]) for (const y of [0, 14, 28]) tubes.push([y, z]);
  INSIDE_TUBES = tubeShapes;
  const plates = [record(A.disc(BF, B.x0, B.x0 + 2, B.bore - 0.1, { name: "boiler.tubeplate", ...BOIL })), record(A.disc(BF, B.x1 - 2, B.x1, B.bore - 0.1, { name: "boiler.tubeplate", ...BOIL }))];
  for (const [y, z] of tubes.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const F = alongX(0, y, z);
    inside.push(S(G.disc(B.x0 + 2, B.x1 - 2, 2.6, F, P), { tone: "hi", crease: "none" }));
    tubeShapes.push({ F, s0: B.x0 + 2, s1: B.x1 - 2, r: 2.6, name: "boiler.tube" });
  }
  // water up to the level line, a circular segment extruded along the boiler
  const chord = Math.sqrt(B.bore ** 2 - (B.water - BZ) ** 2);
  const segment = [];
  const a0 = Math.atan2(B.water - BZ, chord);
  for (let i = 0; i <= 40; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 40;
    segment.push([B.bore * Math.cos(a), B.bore * Math.sin(a)]);
  }
  inside.push(`<g class="lc-water">${S(G.prismOf(BF, segment.map(([y, z]) => [y, z]), B.x0 + 1, B.x1 - 1, P), { tone: "mid", crease: "none" })}</g>`);
  // dry pipe above the water, from the dome forward to the smokebox tubeplate
  const DF = alongX(0, 0, BZ + 32);
  inside.push(S(G.disc(B.x0 + 1, -40, 5, DF, P), { tone: "hi", crease: "none", inner: Ln([-150, -95].map((x) => G.arcOf(DF, x, 5, P)).join(""), { tone: "faint" }) }));
  tubeShapes.push({ F: DF, s0: B.x0 + 2, s1: -40, r: 5, name: "boiler.dry-pipe" });
  inside.push(S(G.sphereOf([-40, 0, BZ + 32], 6.5, P, { steps: 28 }), { tone: "hi" }));
  const elbow = record(A.ball([-40, 0, BZ + 32], 6.5, { name: "boiler.dry-elbow", ...BOIL }));
  const riser = alongY(-40, 0, 0);
  const RF = vertical(-40, 0);
  inside.push(S(G.disc(BZ + 32 + Math.sqrt(6.5 ** 2 - 4 ** 2), BZ + B.bore + 1, 4, RF, P), { tone: "hi", crease: "none" }));
  const riserShape = record(A.disc(RF, BZ + 32 + Math.sqrt(6.5 ** 2 - 4 ** 2), BZ + B.bore + 1, 4, { name: "boiler.regulator-pipe", ...BOIL }));
  void riser;
  const window = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${inside.join("")}</g><path class="iso-line lc-cut" data-tone="lo" d="${path}"/>`;
  const BANDS = [B.x0 + 4, B.x1 - 5];
  const cuts = [B.x0, BANDS[0] - 1.2, BANDS[0] + 1.2, BANDS[1] - 1.2, BANDS[1] + 1.2, B.x1];
  // every long part inside is recorded piecewise, each piece with the barrel segment or band that hides it
  const within = (x0, x1) => tubeShapes.filter((t) => t.s1 > x0 && t.s0 < x1).map((t) => record(A.disc(t.F, Math.max(t.s0, x0), Math.min(t.s1, x1), t.r, { name: t.name, ...BOIL })));
  const nearestIndex = [0, 2, 4].reduce((best, i) => (k.depthOf([(cuts[i] + cuts[i + 1]) / 2, 0, BZ], P) > k.depthOf([(cuts[best] + cuts[best + 1]) / 2, 0, BZ], P) ? i : best), 0);
  for (let i = 0; i < cuts.length; i += 2) {
    const [x0, x1] = [cuts[i], cuts[i + 1]];
    const holds = x0 <= WIN.x0 && x1 >= WIN.x1;
    const last = i === nearestIndex;
    const name = `boiler.barrel${i / 2}`;
    const paths = G.solidOf([[x0, B.r], [x1, B.r]], BF, P, { steps: 96, smooth: false });
    const own = holds
      ? [record(A.ring(BF, x0, WIN.x0, B.bore, B.r, { name, ...BOIL })), record(A.prism(BF, cSection(B.r, B.bore, WIN.deg0, WIN.deg1), WIN.x0, WIN.x1, { name, ...BOIL })), record(A.ring(BF, WIN.x1, x1, B.bore, B.r, { name, ...BOIL }))]
      : [record(A.ring(BF, x0, x1, B.bore, B.r, { name, ...BOIL }))];
    const extra = holds ? [elbow, riserShape] : [];
    if (i === 0) extra.push(plates[0]);
    if (i === cuts.length - 2) extra.push(plates[1]);
    put([(x0 + x1) / 2, 0, BZ], S(paths, { tone: "hi" }) + (last ? window : ""), { name, shapes: [...own, ...within(x0, x1), ...extra] });
  }
}
// boiler bands at the ends
for (const x of [B.x0 + 4, B.x1 - 5]) {
  const id = nameFor("boiler.band");
  const inside = INSIDE_TUBES.filter((t) => t.s1 > x - 1.2 && t.s0 < x + 1.2).map((t) => record(A.disc(t.F, Math.max(t.s0, x - 1.2), Math.min(t.s1, x + 1.2), t.r, { name: t.name, ...BOIL })));
  put([x, 0, BZ], S(G.ringBand(x - 1.2, x + 1.2, B.r - 0.2, B.r + 0.7, BF, P), { tone: "mid" }), { name: id, shapes: [record(A.ring(BF, x - 1.2, x + 1.2, B.bore, B.r + 0.7, { name: id, ...BOIL })), ...inside] });
}
// smokebox, saddle, door, chimney
const SM = { x0: -262, x1: B.x0, r: 52 };
turned(BF, [[SM.x0, SM.r], [SM.x1 + 0.01, SM.r]], { name: "boiler.smokebox", owner: "smokebox", tone: "mid", steps: 96, inner: G.arcOf(BF, SM.x0 + 10, SM.r, P) + G.arcOf(BF, SM.x1 - 8, SM.r, P), extra: Dots(G.dotsOf(BF, SM.x0 + 10, SM.r, 26, P, { fade: [0.04, 0.42] }), { size: 0.38, tone: "mid" }) });
boxAt({ x: -250, y: -48, w: 50, d: 96, r: 1 }, 72, BZ - SM.r + 0.01, { name: "boiler.saddle", owner: "smokebox", tone: "mid", bevel: 0 });
{
  const dome = (s) => 40 * Math.sqrt(Math.max(0, 1 - (s / 9) ** 2));
  const DOOR = [[0, 40], ...Array.from({ length: 12 }, (_, i) => [((i + 1) / 12) * 9, dome(((i + 1) / 12) * 9), i < 11 ? 1 : 0])];
  DOOR[DOOR.length - 1] = [9, 0];
  const DRF = G.frameAlong([SM.x0, 0, BZ], [-1, 0, 0]);
  turned(DRF, DOOR, { name: "boiler.door", owner: "smokebox", tone: "mid", smooth: { slope: (s) => (s >= 9 ? 0 : (-40 * s) / (81 * Math.sqrt(Math.max(1e-6, 1 - (s / 9) ** 2)))), rows: 5 }, extra: Dots(G.dotsOf(DRF, 0.6, 36, 16, P, { all: true }), { size: 0.4, tone: "mid" }) });
  // dart handle
  const HF = G.frameAlong([SM.x0 - 9, 0, BZ], [-1, 0, 0]);
  discAt(HF, 0, 3, 2.2, { tone: "hi", name: "boiler.dart", owner: "smokebox" });
  const CHF = G.frameOf([-226, 0, BZ], UP, [1, 0, 0], [0, 1, 0]);
  const padR = 15;
  const low = Math.min(...Array.from({ length: 48 }, (_, i) => G.saddleStart(SM.r, padR, (i / 48) * Math.PI * 2)));
  const face = SM.r + 4;
  const host = R.solids.find((s) => s.name === "boiler.smokebox");
  put([-226, 0, BZ + face - 2], S(G.saddleOf(CHF, padR, SM.r, face, P), { tone: "mid" }), { bias: 0.2, name: "boiler.chimney-base", shapes: [record(A.disc(CHF, SM.r, face, padR, { name: "boiler.chimney-base", owner: "smokebox" }))] });
  turned(CHF, [[face, 13.5], [face + 6, 11.5]], { name: "boiler.chimney-foot", owner: "smokebox", tone: "mid" });
  turned(CHF, [[face + 6, 11], [face + 68, 11]], { name: "boiler.chimney", owner: "smokebox", tone: "mid", inner: G.arcOf(CHF, face + 30, 11, P) });
  turned(CHF, [[face + 68, 11], [face + 68, 14], [face + 76, 14.6], [face + 76, 0]], { name: "boiler.chimney-cap", owner: "smokebox", tone: "mid", extra: `<path class="lc-cavity" d="${G.circleOf(CHF, face + 76, 10.5, P)}"/>` + Ln(G.arcOf(CHF, face + 76, 10.5, P, { inward: true, least: -1 }), { tone: "lo" }) });
}
// dome on a saddle pad
{
  const DF = G.frameOf([-40, 0, BZ], UP, [1, 0, 0], [0, 1, 0]);
  const padR = 23;
  const low = Math.min(...Array.from({ length: 48 }, (_, i) => G.saddleStart(B.r, padR, (i / 48) * Math.PI * 2)));
  const face = B.r + 3;
  put([-40, 0, BZ + face - 1.5], S(G.saddleOf(DF, padR, B.r, face, P), { tone: "hi" }), { bias: 0.2, name: "boiler.dome-base", shapes: [record(A.disc(DF, B.r, face, padR, { name: "boiler.dome-base", ...BOIL }))] });
  const cap = (s) => 21 * Math.sqrt(Math.max(0, 1 - (s / 10) ** 2));
  const CAP = Array.from({ length: 13 }, (_, i) => [face + 26 + (10 * i) / 12, cap((10 * i) / 12), i && i < 12 ? 1 : 0]);
  CAP[12] = [face + 36, 0];
  turned(DF, [[face, 21], [face + 26, 21], ...CAP], { name: "boiler.dome", ...BOIL, extra: Dots(G.dotsOf(DF, face + 1.5, 21, 18, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }), inner: G.arcOf(DF, face + 24, 21, P), smooth: { slope: (s) => (s < face + 26 ? 0 : s >= face + 36 ? 0 : (-21 * (s - face - 26)) / (100 * Math.sqrt(Math.max(1e-6, 1 - ((s - face - 26) / 10) ** 2)))), rows: 5 } });
}
// firebox, ashpan, safety valves
const FB = { x0: 135, x1: 225, y: 50, z0: 30, z1: 178 };
{
  const plan = { x: FB.x0, y: -FB.y, w: FB.x1 - FB.x0, d: FB.y * 2, r: 6 };
  const WIN = GEO.windows.fire;
  const face = FB.y;
  const corner = 3;
  const pts = [];
  const cornerPts = (cx, cz, start) => {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2);
      pts.push([cx + corner * Math.cos(a), face, cz + corner * Math.sin(a)]);
    }
  };
  cornerPts(WIN.x1 - corner, WIN.z1 - corner, 0);
  cornerPts(WIN.x0 + corner, WIN.z1 - corner, Math.PI / 2);
  cornerPts(WIN.x0 + corner, WIN.z0 + corner, Math.PI);
  cornerPts(WIN.x1 - corner, WIN.z0 + corner, 1.5 * Math.PI);
  const path = k.pathOf(pts.map(at), true);
  const id = `lc-win${clipCount++}`;
  const inside = [`<path class="lc-firebox" d="${path}"/>`];
  // inner firebox: back wall seam lines and the grate
  for (const x of [160, 180, 200]) inside.push(Ln(k.segment([x, -FB.y + 8, WIN.z0 - 2], [x, -FB.y + 8, WIN.z1 + 2], P), { tone: "faint" }));
  const grate = { x: FB.x0 + 8, y: -FB.y + 8, w: FB.x1 - FB.x0 - 16, d: FB.y * 2 - 16, r: 0.5 };
  for (let y = grate.y + 4; y < grate.y + grate.d; y += 6) inside.push(Ln(k.lineOnTop([grate.x, y], [grate.x + grate.w, y], 50, P), { tone: "lo" }));
  // fire glow on the grate, then coal
  const gc = at([180, 0, 58]);
  inside.push(`<defs><radialGradient id="lc-fire" gradientUnits="userSpaceOnUse" cx="${gc[0].toFixed(1)}" cy="${gc[1].toFixed(1)}" r="${(48 * G.scaleOf(P)).toFixed(1)}"><stop offset="0" class="lc-fire-stop-0"/><stop offset=".45" class="lc-fire-stop-1"/><stop offset="1" class="lc-fire-stop-2"/></radialGradient></defs><ellipse class="lc-fire-glow" cx="${gc[0].toFixed(1)}" cy="${gc[1].toFixed(1)}" rx="${(46 * G.scaleOf(P)).toFixed(1)}" ry="${(30 * G.scaleOf(P)).toFixed(1)}" fill="url(#lc-fire)"/>`);
  const coals = [];
  for (let i = 0; i < 26; i++) {
    const x = 150 + ((i * 37) % 60);
    const y = -40 + ((i * 53) % 78);
    const r = 3 + ((i * 7) % 3);
    coals.push([x, y, 50 + r, r]);
  }
  for (const [x, y, z, r] of coals.sort((a, b) => k.depthOf([a[0], a[1], a[2]], P) - k.depthOf([b[0], b[1], b[2]], P))) inside.push(S(G.sphereOf([x, y, z], r, P, { steps: 20 }), { tone: "lo", className: "lc-coal" }));
  const window = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${inside.join("")}</g><path class="iso-line lc-cut" data-tone="lo" d="${path}"/>`;
  const walls = [
    [[FB.x0, -FB.y, FB.z0], [FB.x1, FB.y, FB.z0 + 14]],
    [[FB.x0, -FB.y, FB.z1 - 8], [FB.x1, FB.y, FB.z1]],
    [[FB.x0, -FB.y, FB.z0], [FB.x1, -FB.y + 8, FB.z1]],
    [[FB.x0, FB.y - 8, FB.z0], [FB.x1, FB.y, FB.z1]],
    [[FB.x0, -FB.y, FB.z0], [FB.x0 + 8, FB.y, FB.z1]],
    [[FB.x1 - 8, -FB.y, FB.z0], [FB.x1, FB.y, FB.z1]],
  ].map(([lo, hi]) => record(A.box(lo, hi, { name: "firebox.wrapper", owner: "firebox" })));
  put([(FB.x0 + FB.x1) / 2, 0, (FB.z0 + FB.z1) / 2], S(k.slabOf(plan, FB.z0, FB.z1 - FB.z0, P, 6, 0.8), { tone: "hi", inner: Ln(k.sideSeam(plan, FB.z1 - 14, P, 6), { tone: "faint" }) }) + Dots([[143, 160], [217, 160], [143, 40], [217, 40]].map(([x, z]) => at([x, FB.y, z])), { size: 0.45, tone: "mid" }) + window, { name: "firebox.wrapper", shapes: walls });
  boxAt({ x: 147, y: -40, w: 66, d: 80, r: 1 }, 20, FB.z0 + 0.01, { name: "firebox.ashpan", owner: "frame", tone: "mid", bevel: 0 });
  for (const y of [-11, 11]) {
    const F = vertical(180, y);
    turned(F, [[FB.z1, 4.5], [FB.z1 + 3, 4.5], [FB.z1 + 3, 3], [FB.z1 + 14, 3], [FB.z1 + 14, 4], [FB.z1 + 17, 4], [FB.z1 + 17, 0]], { name: "firebox.safety-valve", owner: "firebox", tone: "mid" });
  }
}
// cab
const CAB = { owner: "cab" };
boxAt({ x: 225, y: -52, w: 75, d: 104, r: 0.5 }, FRAME_TOP, FRAME_TOP + 4, { name: "cab.floor", ...CAB, tone: "mid", bevel: 0 });
for (const [y0, y1] of [[-62, -56], [56, 62]]) {
  boxAt({ x: 225, y: y0, w: 75, d: y1 - y0, r: 0.6 }, FRAME_TOP + 4, 136, { name: "cab.side", ...CAB, tone: "hi", bevel: 0.4, inner: y0 > 0 ? Ln(k.sideSeam({ x: 225, y: y0, w: 75, d: y1 - y0, r: 0.6 }, 116, P, 2), { tone: "faint" }) : "" });
  boxAt({ x: 225, y: y0, w: 8, d: y1 - y0, r: 0.6 }, 136, 204, { name: "cab.pillar", ...CAB, tone: "hi", bevel: 0.3 });
  boxAt({ x: 292, y: y0, w: 8, d: y1 - y0, r: 0.6 }, 136, 204, { name: "cab.pillar", ...CAB, tone: "hi", bevel: 0.3 });
}
boxAt({ x: 294, y: -56, w: 6, d: 112, r: 0.5 }, FRAME_TOP + 4, 204, { name: "cab.back", ...CAB, tone: "hi", bevel: 0.3 });
boxAt({ x: 225, y: -56, w: 5, d: 112, r: 0.5 }, FB.z1, 204, { name: "cab.front", ...CAB, tone: "hi", bevel: 0.3, extra: Ln([-28, 28].map((y) => k.sideRing([225, y, 191], 6, "x", P, 24)).join(""), { tone: "lo" }) });
boxAt({ x: 218, y: -74, w: 92, d: 148, r: 3 }, 204, 209, { name: "cab.roof", ...CAB, tone: "mid", bevel: 1, extra: Ln(k.planOutline(k.insetPlan({ x: 218, y: -74, w: 92, d: 148, r: 3 }, 5), 209, P), { tone: "faint" }) });

// steam pipe from the smokebox down to the chest
{
  const radial = [0, Math.cos(10 * RAD), Math.sin(10 * RAD)];
  const PF = G.frameAlong([-240, 0, BZ], radial);
  const padR = 8;
  const face = SM.r + 3;
  const host = R.solids.find((s) => s.name === "boiler.smokebox");
  const low = Math.min(...Array.from({ length: 48 }, (_, i) => G.saddleStart(SM.r, padR, (i / 48) * Math.PI * 2)));
  put(G.add3(PF.o, G.mul3(radial, face - 1)), S(G.saddleOf(PF, padR, SM.r, face, P), { tone: "mid" }), { bias: 0.2, name: "pipe.pad", shapes: [record(A.disc(PF, SM.r, face, padR, { name: "pipe.pad", owner: "smokebox" }))] });
  const start = G.add3(PF.o, G.mul3(radial, face));
  const knee = G.add3(PF.o, G.mul3(radial, face + 20));
  const route = G.fillet([start, knee, [-240, 82, knee[2]], [-240, 82, CH.z1]], 14, 12, { P, tube: 5 });
  const total = G.pathLength(route);
  const thick = 2.2;
  const gaps = [[0, thick], [total - thick, total]];
  R.route("pipe.steam", route, 5, { owner: "pipe.steam", gaps, rims: [7.5, 7.5] });
  for (const part of tubePieces(route, 5, P, { maxLength: 18, spacing: 1.2, gaps })) put(part.mid, tubeSvg(part, { tone: "mid" }), { bias: 0.3, name: `pipe.steam:${part.from}`, shapes: [A.tube(part.points, part.radii)] });
  for (const [along, sign] of [[0, 1], [total, -1]]) {
    const tangent = G.tangentAlong(route, along);
    const end = G.pointAlong(route, along);
    const F = G.frameAlong(end, G.mul3(tangent, sign));
    put(G.add3(end, G.mul3(F.a, thick / 2)), S(G.disc(0, thick, 7.5, F, P), { tone: "mid" }) + (G.dot3(F.a, V) > 0.12 ? Dots(G.dotsOf(F, thick, 5.6, 6, P, { all: true }), { size: 0.4, tone: "mid" }) : ""), { bias: 0.3, name: "pipe.steam.flange", shapes: [record(A.disc(F, 0, thick, 7.5, { name: "pipe.steam.flange", owner: "pipe.steam" }))] });
  }
}
// ---------------------------------------------------------------- motion at rest
{
  const ch = parts.crosshead(REST);
  putDescs(ch.descs, [ch.xc, 80, Z], { name: "motion.crosshead", dyn: "crosshead" });
  putDescs(ch.nose, [ch.xc, 96, Z], { name: "motion.pin-nose", dyn: "pin-nose", bias: 0.5 });
  putDescs(parts.conrod(REST), [(ch.xc + parts.pinAt(GEO.axles[1], REST)[0]) / 2, 91, Z], { name: "conrod", dyn: "conrod" });
  putDescs(parts.couplingRod(REST), [0, 83, Z], { name: "coupling", dyn: "coupling" });
  const pins = parts.pins(REST);
  putDescs(pins.front, [GEO.axles[0], 87, Z], { name: "crank.front-nose", dyn: "front-nose", bias: 0.4 });
  putDescs(pins.rear, [GEO.axles[1], 87, Z], { name: "crank.rear-pin", dyn: "rear-pin", bias: 0.4 });
  const gear = parts.valveGear(REST);
  putDescs(gear.crank, [GEO.axles[1], 98, Z], { name: "gear.return-crank", dyn: "return-crank", bias: 0.6 });
  putDescs(gear.rod, [-60, 100, 55], { name: "gear.rod", dyn: "gear-rod", bias: 0.5 });
}

// ---------------------------------------------------------------- emit
A.settle(R, P, { skip: skipPair });
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it"${item.dyn ? ` data-dyn="${item.dyn}"` : ""} data-i="${index}">${item.svg}</g>`);
const LABEL_TEXT =
  "A small four-wheeled industrial steam locomotive on a length of track, seen from the front quarter. The boiler is cut open along its side to show the fire tubes under the water and the dry pipe above it; the firebox is cut open to show the fire on its grate; the near cylinder and its steam chest are cut open to show the piston and the slide valve. On the near side the piston rod, crosshead, connecting rod and coupling rod drive the two wheels, and a return crank on the rear crankpin works the valve. Puffs of exhaust leave the chimney in step with the valve.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g class="lc-loco">${groups.join("")}</g>`] });
const chimneyTop = [-226, 0, BZ + SM.r + 4 + 76];
const DATA = { W, H, P, camera: glCamera(P), rest: REST, chimney: chimneyTop, beats: M.BEATS, shownRpm: M.LOCO.shownRpm, events: M.EVENTS };
const EVENT_BUTTONS = [["admission", "Admission", M.EVENTS.head.admission + 2], ["cutoff", "Cut-off", M.EVENTS.head.cutoff + 1], ["release", "Release", M.EVENTS.head.release + 1], ["compression", "Compression", M.EVENTS.head.compression + 1]]
  .map(([id, name, deg], index) => `<button type="button" class="lc-event" data-event="${id}" data-at="${deg.toFixed(1)}"><span class="lc-num">${String(index + 1).padStart(2, "0")}</span>${name}</button>`)
  .join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 4</span><span class="iso-plate-corner" data-corner="title">0-4-0 locomotive</span><span class="iso-plate-corner" data-corner="readout" data-readout>wheel 60° · head end steam admitted · 11.0 bar</span></div>`;
const controls = `<div class="lc-controls"><button type="button" class="lc-play" data-play><span class="lc-lamp" aria-hidden="true"></span><span data-play-label>Run</span></button><span class="lc-hint">Drag across the engine to roll it by hand</span><span class="lc-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="lc-stage" tabindex="0" role="slider" aria-label="Steam locomotive. Drag or use the arrow keys to turn the wheels; Space runs and stops it." aria-valuemin="0" aria-valuemax="360" aria-valuenow="${REST}" aria-valuetext="Wheels at 60 degrees">${svg}<canvas class="lc-puffs" aria-hidden="true"></canvas></div>`;
const caption = `An industrial 0-4-0 with two outside cylinders of ${M.LOCO.bore / 10} by ${M.LOCO.stroke / 10} cm on ${M.LOCO.wheelDia / 100} m wheels, working at ${M.LOCO.boilerBar} bar. Coal burns on the grate; hot gas runs forward through the fire tubes inside the water, boils it, and leaves up the chimney. Steam collects above the water, enters the dry pipe under the dome, and reaches the chests through the smokebox. The slide valve admits it to one end of the cylinder at a time and opens the other end to the blast pipe, so each cylinder exhausts twice a turn and the two cylinders, set a quarter turn apart, give four puffs per wheel revolution; those puffs draw the fire. The piston turns the rear wheels through the crosshead and connecting rod, the coupling rod carries the drive to the front pair, and a return crank on the rear crankpin works the valve, here with a fixed ${Math.round((M.pistonAt(M.EVENTS.head.cutoff) / M.LOCO.stroke) * 100)}% cut-off. Mean effort at the rail ${M.meanEffortKn.toFixed(0)} kN against a rated ${M.ratedEffortKn.toFixed(0)} kN; the figure runs at ${M.LOCO.shownRpm} rpm, ${M.speedKmh(M.LOCO.shownRpm).toFixed(1)} km/h.`;
const body = `<figure class="iso-figure lc"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="lc-events">${EVENT_BUTTONS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;
const latheScript = () => readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "").replace(/\b(oriented|signedArea|runsOf)\b/g, "lathe_$1");
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "loco.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Steam locomotive", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + "\n" + latheScript() + "\n" + glScript() + "\n" + strip("model.mjs") + "\n" + strip("parts.mjs") + "\n" + LIVE, width: 1120 });
const name = THEME === "light" ? "locomotive-light.html" : "locomotive.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);
A.auditOrExit(R, P, { cover: ["cyl.barrel", "cyl.chest", "boiler.barrel0", "boiler.barrel1", "boiler.barrel2", "firebox.wrapper", "wheel0.inner-wall", "wheel1.inner-wall", "wheel0.tyre", "wheel1.tyre", "boiler.chimney-cap"], allow: ALLOW, crowd: [["pipe.steam", "frame.plate#2"]] });
